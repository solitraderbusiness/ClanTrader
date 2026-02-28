//+------------------------------------------------------------------+
//| ClanTrader_EA.mq4 — MetaTrader 4 Expert Advisor                |
//| Connects MT4 to ClanTrader platform                             |
//+------------------------------------------------------------------+
#property copyright "ClanTrader"
#property link      "https://clantrader.ir"
#property version   "1.00"
#property strict

#include <ClanTrader_JSON.mqh>
#include <ClanTrader_HTTP.mqh>
#include <ClanTrader_Panel.mqh>

//--- Input parameters ---
input string InpBaseUrl = "https://clantrader.ir"; // Server URL

//--- Global state ---
bool     g_Connected = false;
int      g_KnownTickets[];
double   g_KnownSL[];
double   g_KnownTP[];
datetime g_LastHistorySync = 0;
string   g_ActionError = "";
int      g_TimerTick = 0;

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit() {
   SetBaseUrl(InpBaseUrl);
   PanelCreate();
   EventSetTimer(3);
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization                                           |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
   EventKillTimer();
   PanelDestroy();
}

//+------------------------------------------------------------------+
//| Timer handler — fast poll + heartbeat                              |
//+------------------------------------------------------------------+
void OnTimer() {
   if (!g_Connected) return;
   g_TimerTick++;

   // Poll for pending actions every 3 seconds (fast action delivery)
   if (g_TimerTick % 10 != 0) {
      PollPendingActions();
   }

   // Full heartbeat every 30 seconds (every 10th tick)
   if (g_TimerTick % 10 == 0) {
      SendHeartbeat();
      if (TimeCurrent() - g_LastHistorySync > 300) {
         SyncTradeHistory();
         g_LastHistorySync = TimeCurrent();
      }
   }
}

//+------------------------------------------------------------------+
//| Lightweight poll for pending actions (every 3s)                    |
//+------------------------------------------------------------------+
void PollPendingActions() {
   string response;
   int code = HttpGet("/api/ea/poll-actions", response);
   if (code == 200) {
      ProcessPendingActions(response);
   }
}

//+------------------------------------------------------------------+
//| Tick handler — detect trade changes                               |
//+------------------------------------------------------------------+
void OnTick() {
   if (!g_Connected) return;
   DetectTradeChanges();
}

//+------------------------------------------------------------------+
//| Chart event handler — button clicks                               |
//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam) {
   if (id != CHARTEVENT_OBJECT_CLICK) return;

   if (sparam == PANEL_BTN_LOGIN) {
      // Reset button state
      ObjectSetInteger(0, PANEL_BTN_LOGIN, OBJPROP_STATE, false);
      DoLogin();
   }
   else if (sparam == PANEL_BTN_REG) {
      ObjectSetInteger(0, PANEL_BTN_REG, OBJPROP_STATE, false);
      DoRegister();
   }
}

//+------------------------------------------------------------------+
//| Login to ClanTrader                                               |
//+------------------------------------------------------------------+
void DoLogin() {
   string username = PanelGetUsername();
   string password = PanelGetPassword();

   if (username == "" || password == "") {
      PanelSetStatus("Enter username & password", CLR_ERR);
      return;
   }

   PanelSetStatus("Logging in...", CLR_LABEL);

   string json = JsonStart();
   json += JsonAddString("username", username);
   json += JsonAddString("password", password);
   json += JsonAddInt("accountNumber", AccountNumber());
   json += JsonAddString("broker", AccountCompany());
   json += JsonAddString("platform", "MT4");
   json += JsonAddString("serverName", AccountServer());
   JsonEnd(json);

   string response;
   int code = HttpPost("/api/ea/login", json, response);

   if (code == 200) {
      string apiKey = JsonGetString(response, "apiKey");

      if (apiKey == "") {
         PanelSetStatus("Login error: bad response", CLR_ERR);
         return;
      }

      SetApiKey(apiKey);
      g_Connected = true;

      PanelShowConnected(AccountCompany(), AccountNumber(), AccountBalance(), AccountCurrency());

      // Cache current open tickets
      CacheOpenTickets();

      // Send immediate heartbeat so live R:R updates right away
      SendHeartbeat();

      // Initial history sync
      SyncTradeHistory();
      g_LastHistorySync = TimeCurrent();
   }
   else if (code == 401) {
      PanelSetStatus("Invalid credentials", CLR_ERR);
   }
   else {
      string err = JsonGetString(response, "error");
      PanelSetStatus("Error: " + err, CLR_ERR);
   }
}

//+------------------------------------------------------------------+
//| Register new account                                              |
//+------------------------------------------------------------------+
void DoRegister() {
   string username = PanelGetUsername();
   string password = PanelGetPassword();

   if (username == "" || password == "") {
      PanelSetStatus("Enter username & password", CLR_ERR);
      return;
   }

   if (StringLen(password) < 8) {
      PanelSetStatus("Password min 8 characters", CLR_ERR);
      return;
   }

   PanelSetStatus("Registering...", CLR_LABEL);

   string json = JsonStart();
   json += JsonAddString("username", username);
   json += JsonAddString("password", password);
   json += JsonAddInt("accountNumber", AccountNumber());
   json += JsonAddString("broker", AccountCompany());
   json += JsonAddString("platform", "MT4");
   json += JsonAddString("serverName", AccountServer());
   JsonEnd(json);

   string response;
   int code = HttpPost("/api/ea/register", json, response);

   if (code == 201) {
      string apiKey = JsonGetString(response, "apiKey");

      if (apiKey == "") {
         PanelSetStatus("Register error: bad response", CLR_ERR);
         return;
      }

      SetApiKey(apiKey);
      g_Connected = true;

      PanelShowConnected(AccountCompany(), AccountNumber(), AccountBalance(), AccountCurrency());

      CacheOpenTickets();

      // Send immediate heartbeat so live R:R updates right away
      SendHeartbeat();

      SyncTradeHistory();
      g_LastHistorySync = TimeCurrent();
   }
   else if (code == 409) {
      PanelSetStatus("Username already taken", CLR_ERR);
   }
   else {
      string err = JsonGetString(response, "error");
      PanelSetStatus("Error: " + err, CLR_ERR);
   }
}

//+------------------------------------------------------------------+
//| Send heartbeat with balance + open trades                         |
//+------------------------------------------------------------------+
void SendHeartbeat() {
   string json = JsonStart();
   json += JsonAddDouble("balance", AccountBalance());
   json += JsonAddDouble("equity", AccountEquity());
   json += JsonAddDouble("margin", AccountMargin());
   json += JsonAddDouble("freeMargin", AccountFreeMargin());

   // Open trades array
   string tradesArr = JsonArrayStart();
   int total = OrdersTotal();
   for (int i = 0; i < total; i++) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if (OrderType() > OP_SELL) continue; // Skip pending orders

      string t = JsonStart();
      t += JsonAddInt("ticket", OrderTicket());
      t += JsonAddString("symbol", OrderSymbol());
      t += JsonAddString("direction", OrderType() == OP_BUY ? "BUY" : "SELL");
      t += JsonAddDouble("lots", OrderLots());
      t += JsonAddDouble("openPrice", OrderOpenPrice());
      t += JsonAddString("openTime", DateTimeToISO(OrderOpenTime()));
      t += JsonAddDouble("stopLoss", OrderStopLoss());
      t += JsonAddDouble("takeProfit", OrderTakeProfit());
      t += JsonAddDouble("profit", OrderProfit());
      t += JsonAddDouble("currentPrice", MarketInfo(OrderSymbol(), MODE_BID));
      t += JsonAddDouble("commission", OrderCommission());
      t += JsonAddDouble("swap", OrderSwap());
      t += JsonAddString("comment", OrderComment());
      t += JsonAddInt("magicNumber", OrderMagicNumber());
      t += JsonAddBool("isOpen", true);
      JsonEnd(t);
      tradesArr += t + ",";
   }
   JsonArrayEnd(tradesArr);

   json += JsonAddRaw("openTrades", tradesArr);
   JsonEnd(json);

   string response;
   int code = HttpPost("/api/ea/heartbeat", json, response);

   if (code == 200) {
      PanelShowConnected(AccountCompany(), AccountNumber(), AccountBalance(), AccountCurrency());
      // Process any pending actions from server
      ProcessPendingActions(response);
   }
   else if (code == 429) {
      // Rate limited — ignore
   }
   else {
      PanelSetStatus("Heartbeat error", CLR_ERR);
   }
}

//+------------------------------------------------------------------+
//| Process pending actions from heartbeat response                    |
//+------------------------------------------------------------------+
void ProcessPendingActions(string response) {
   string actionsJson = JsonGetValue(response, "pendingActions");
   if (actionsJson == "" || actionsJson == "[]") return;

   string items[];
   int count = SplitJsonArray(actionsJson, items);

   for (int i = 0; i < count; i++) {
      string actionId = JsonGetString(items[i], "id");
      string ticketStr = JsonGetString(items[i], "ticket");
      string actionType = JsonGetString(items[i], "actionType");
      string newValue = JsonGetString(items[i], "newValue");

      if (actionId == "" || ticketStr == "") continue;

      int ticket = (int)StringToInteger(ticketStr);
      bool success = ExecuteMtAction(ticket, actionType, newValue);
      ReportActionResult(actionId, success);
   }
}

//+------------------------------------------------------------------+
//| Execute a trade action in MetaTrader                               |
//+------------------------------------------------------------------+
bool ExecuteMtAction(int ticket, string actionType, string newValue) {
   g_ActionError = "";

   if (!OrderSelect(ticket, SELECT_BY_TICKET, MODE_TRADES)) {
      g_ActionError = "Failed to select ticket #" + IntegerToString(ticket);
      Print("[EA Action] ", g_ActionError);
      return false;
   }

   // Verify this is an open market order
   if (OrderType() > OP_SELL) {
      g_ActionError = "Ticket #" + IntegerToString(ticket) + " is a pending order, not a market order";
      Print("[EA Action] ", g_ActionError);
      return false;
   }

   double openPrice = OrderOpenPrice();
   double currentSL = OrderStopLoss();
   double currentTP = OrderTakeProfit();
   double lots = OrderLots();
   string symbol = OrderSymbol();
   int slippage = 3;

   if (actionType == "SET_BE") {
      bool result = OrderModify(ticket, openPrice, openPrice, currentTP, 0);
      if (!result) {
         g_ActionError = "SET_BE error " + IntegerToString(GetLastError());
         Print("[EA Action] ", g_ActionError);
      }
      return result;
   }
   else if (actionType == "MOVE_SL") {
      double newSL = StringToDouble(newValue);
      if (newSL <= 0) {
         g_ActionError = "Invalid SL value: " + newValue;
         Print("[EA Action] ", g_ActionError);
         return false;
      }
      bool result = OrderModify(ticket, openPrice, newSL, currentTP, 0);
      if (!result) {
         g_ActionError = "MOVE_SL error " + IntegerToString(GetLastError());
         Print("[EA Action] ", g_ActionError);
      }
      return result;
   }
   else if (actionType == "CHANGE_TP") {
      double newTP = StringToDouble(newValue);
      if (newTP <= 0) {
         g_ActionError = "Invalid TP value: " + newValue;
         Print("[EA Action] ", g_ActionError);
         return false;
      }
      bool result = OrderModify(ticket, openPrice, currentSL, newTP, 0);
      if (!result) {
         g_ActionError = "CHANGE_TP error " + IntegerToString(GetLastError());
         Print("[EA Action] ", g_ActionError);
      }
      return result;
   }
   else if (actionType == "CLOSE") {
      double closePrice;
      if (OrderType() == OP_BUY)
         closePrice = MarketInfo(symbol, MODE_BID);
      else
         closePrice = MarketInfo(symbol, MODE_ASK);

      bool result = OrderClose(ticket, lots, closePrice, slippage);
      if (!result) {
         g_ActionError = "CLOSE error " + IntegerToString(GetLastError());
         Print("[EA Action] ", g_ActionError);
      }
      return result;
   }

   g_ActionError = "Unknown action type: " + actionType;
   Print("[EA Action] ", g_ActionError);
   return false;
}

//+------------------------------------------------------------------+
//| Report action result back to server                                |
//+------------------------------------------------------------------+
void ReportActionResult(string actionId, bool success) {
   string json = JsonStart();
   json += JsonAddBool("success", success);
   if (!success) {
      json += JsonAddString("errorMessage", g_ActionError != "" ? g_ActionError : ("MT4 error " + IntegerToString(GetLastError())));
   }
   JsonEnd(json);

   string response;
   HttpPost("/api/ea/actions/" + actionId + "/result", json, response);
}

//+------------------------------------------------------------------+
//| Sync full trade history                                           |
//+------------------------------------------------------------------+
void SyncTradeHistory() {
   string tradesArr = JsonArrayStart();
   int total = OrdersHistoryTotal();
   int count = 0;

   for (int i = 0; i < total && count < 5000; i++) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) continue;
      if (OrderType() > OP_SELL) continue; // Skip pending orders

      string t = JsonStart();
      t += JsonAddInt("ticket", OrderTicket());
      t += JsonAddString("symbol", OrderSymbol());
      t += JsonAddString("direction", OrderType() == OP_BUY ? "BUY" : "SELL");
      t += JsonAddDouble("lots", OrderLots());
      t += JsonAddDouble("openPrice", OrderOpenPrice());
      t += JsonAddDouble("closePrice", OrderClosePrice());
      t += JsonAddString("openTime", DateTimeToISO(OrderOpenTime()));
      t += JsonAddString("closeTime", DateTimeToISO(OrderCloseTime()));
      t += JsonAddDouble("stopLoss", OrderStopLoss());
      t += JsonAddDouble("takeProfit", OrderTakeProfit());
      t += JsonAddDouble("profit", OrderProfit());
      t += JsonAddDouble("commission", OrderCommission());
      t += JsonAddDouble("swap", OrderSwap());
      t += JsonAddString("comment", OrderComment());
      t += JsonAddInt("magicNumber", OrderMagicNumber());
      t += JsonAddBool("isOpen", false);
      JsonEnd(t);
      tradesArr += t + ",";
      count++;
   }
   JsonArrayEnd(tradesArr);

   string json = JsonStart();
   json += JsonAddRaw("trades", tradesArr);
   JsonEnd(json);

   string response;
   HttpPost("/api/ea/trades/sync", json, response);
}

//+------------------------------------------------------------------+
//| Send single trade event                                           |
//+------------------------------------------------------------------+
void SendTradeEvent(string eventType, int ticket) {
   if (!OrderSelect(ticket, SELECT_BY_TICKET)) return;

   string t = JsonStart();
   t += JsonAddInt("ticket", OrderTicket());
   t += JsonAddString("symbol", OrderSymbol());
   t += JsonAddString("direction", OrderType() == OP_BUY ? "BUY" : "SELL");
   t += JsonAddDouble("lots", OrderLots());
   t += JsonAddDouble("openPrice", OrderOpenPrice());
   if (OrderCloseTime() > 0) {
      t += JsonAddDouble("closePrice", OrderClosePrice());
      t += JsonAddString("closeTime", DateTimeToISO(OrderCloseTime()));
   }
   t += JsonAddString("openTime", DateTimeToISO(OrderOpenTime()));
   t += JsonAddDouble("stopLoss", OrderStopLoss());
   t += JsonAddDouble("takeProfit", OrderTakeProfit());
   t += JsonAddDouble("profit", OrderProfit());
   t += JsonAddDouble("commission", OrderCommission());
   t += JsonAddDouble("swap", OrderSwap());
   t += JsonAddString("comment", OrderComment());
   t += JsonAddInt("magicNumber", OrderMagicNumber());
   t += JsonAddBool("isOpen", eventType != "close");
   JsonEnd(t);

   string json = JsonStart();
   json += JsonAddString("event", eventType);
   json += JsonAddRaw("trade", t);
   JsonEnd(json);

   string response;
   HttpPost("/api/ea/trade-event", json, response);
}

//+------------------------------------------------------------------+
//| Detect trade opens/closes by comparing known tickets              |
//+------------------------------------------------------------------+
void DetectTradeChanges() {
   int currentTickets[];
   double currentSL[];
   double currentTP[];
   int total = OrdersTotal();

   // Collect current open tickets with SL/TP
   for (int i = 0; i < total; i++) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if (OrderType() > OP_SELL) continue;
      int size = ArraySize(currentTickets);
      ArrayResize(currentTickets, size + 1);
      ArrayResize(currentSL, size + 1);
      ArrayResize(currentTP, size + 1);
      currentTickets[size] = OrderTicket();
      currentSL[size] = OrderStopLoss();
      currentTP[size] = OrderTakeProfit();
   }

   // Check for new trades (opened)
   for (int i = 0; i < ArraySize(currentTickets); i++) {
      bool found = false;
      for (int j = 0; j < ArraySize(g_KnownTickets); j++) {
         if (currentTickets[i] == g_KnownTickets[j]) { found = true; break; }
      }
      if (!found) {
         SendTradeEvent("open", currentTickets[i]);
      }
   }

   // Check for closed trades
   for (int i = 0; i < ArraySize(g_KnownTickets); i++) {
      bool found = false;
      for (int j = 0; j < ArraySize(currentTickets); j++) {
         if (g_KnownTickets[i] == currentTickets[j]) { found = true; break; }
      }
      if (!found) {
         // Trade closed — try to select from history
         if (OrderSelect(g_KnownTickets[i], SELECT_BY_TICKET))
            SendTradeEvent("close", g_KnownTickets[i]);
      }
   }

   // Check for SL/TP modifications on existing trades
   for (int i = 0; i < ArraySize(currentTickets); i++) {
      for (int j = 0; j < ArraySize(g_KnownTickets); j++) {
         if (currentTickets[i] == g_KnownTickets[j]) {
            if (MathAbs(currentSL[i] - g_KnownSL[j]) > 0.00001 ||
                MathAbs(currentTP[i] - g_KnownTP[j]) > 0.00001) {
               SendTradeEvent("modify", currentTickets[i]);
            }
            break;
         }
      }
   }

   // Update all cache arrays
   ArrayResize(g_KnownTickets, ArraySize(currentTickets));
   ArrayResize(g_KnownSL, ArraySize(currentTickets));
   ArrayResize(g_KnownTP, ArraySize(currentTickets));
   ArrayCopy(g_KnownTickets, currentTickets);
   ArrayCopy(g_KnownSL, currentSL);
   ArrayCopy(g_KnownTP, currentTP);
}

//+------------------------------------------------------------------+
//| Cache current open ticket numbers                                 |
//+------------------------------------------------------------------+
void CacheOpenTickets() {
   ArrayResize(g_KnownTickets, 0);
   ArrayResize(g_KnownSL, 0);
   ArrayResize(g_KnownTP, 0);
   int total = OrdersTotal();
   for (int i = 0; i < total; i++) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if (OrderType() > OP_SELL) continue;
      int size = ArraySize(g_KnownTickets);
      ArrayResize(g_KnownTickets, size + 1);
      ArrayResize(g_KnownSL, size + 1);
      ArrayResize(g_KnownTP, size + 1);
      g_KnownTickets[size] = OrderTicket();
      g_KnownSL[size] = OrderStopLoss();
      g_KnownTP[size] = OrderTakeProfit();
   }
}
//+------------------------------------------------------------------+
