//+------------------------------------------------------------------+
//| ClanTrader_EA.mq5 — MetaTrader 5 Expert Advisor                |
//| Connects MT5 to ClanTrader platform                             |
//+------------------------------------------------------------------+
#property copyright "ClanTrader"
#property link      "https://clantrader.ir"
#property version   "1.00"

#include <ClanTrader_JSON.mqh>
#include <ClanTrader_HTTP.mqh>
#include <ClanTrader_Panel.mqh>

//--- Input parameters ---
input string InpBaseUrl = "https://clantrader.ir"; // Server URL

//--- Global state ---
bool     g_Connected = false;
ulong    g_KnownPositions[];
datetime g_LastHistorySync = 0;
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
//| Tick handler — not used in MT5 (OnTradeTransaction handles it)    |
//+------------------------------------------------------------------+
void OnTick() {
   // Trade events handled via OnTradeTransaction
}

//+------------------------------------------------------------------+
//| Trade transaction handler — real-time trade events                |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result) {
   if (!g_Connected) return;

   if (trans.type == TRADE_TRANSACTION_DEAL_ADD) {
      // Get deal entry type
      if (!HistoryDealSelect(trans.deal)) return;
      long entry = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);

      if (entry == DEAL_ENTRY_IN) {
         // New position opened
         ulong posId = (ulong)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
         if (PositionSelectByTicket(posId)) {
            SendPositionEvent("open", posId);
         }
      }
      else if (entry == DEAL_ENTRY_OUT) {
         // Position closed — reconstruct from history
         ulong posId = (ulong)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
         SendClosedTradeFromHistory(posId);
      }
   }
   else if (trans.type == TRADE_TRANSACTION_REQUEST) {
      // SL/TP modification
      if (request.action == TRADE_ACTION_SLTP && request.position > 0) {
         if (PositionSelectByTicket(request.position)) {
            SendPositionEvent("modify", request.position);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Chart event handler — button clicks                               |
//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam) {
   if (id != CHARTEVENT_OBJECT_CLICK) return;

   if (sparam == PANEL_BTN_LOGIN) {
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

   long acctNum = AccountInfoInteger(ACCOUNT_LOGIN);
   string broker = AccountInfoString(ACCOUNT_COMPANY);
   string server = AccountInfoString(ACCOUNT_SERVER);

   string json = JsonStart();
   json += JsonAddString("username", username);
   json += JsonAddString("password", password);
   json += JsonAddInt("accountNumber", acctNum);
   json += JsonAddString("broker", broker);
   json += JsonAddString("platform", "MT5");
   json += JsonAddString("serverName", server);
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

      PanelShowConnected(broker, acctNum,
         AccountInfoDouble(ACCOUNT_BALANCE),
         AccountInfoString(ACCOUNT_CURRENCY));

      CacheOpenPositions();

      // Send immediate heartbeat so live R:R updates right away
      SendHeartbeat();

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

   long acctNum = AccountInfoInteger(ACCOUNT_LOGIN);
   string broker = AccountInfoString(ACCOUNT_COMPANY);
   string server = AccountInfoString(ACCOUNT_SERVER);

   string json = JsonStart();
   json += JsonAddString("username", username);
   json += JsonAddString("password", password);
   json += JsonAddInt("accountNumber", acctNum);
   json += JsonAddString("broker", broker);
   json += JsonAddString("platform", "MT5");
   json += JsonAddString("serverName", server);
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

      PanelShowConnected(broker, acctNum,
         AccountInfoDouble(ACCOUNT_BALANCE),
         AccountInfoString(ACCOUNT_CURRENCY));

      CacheOpenPositions();

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
//| Send heartbeat with balance + open positions                      |
//+------------------------------------------------------------------+
void SendHeartbeat() {
   string json = JsonStart();
   json += JsonAddDouble("balance", AccountInfoDouble(ACCOUNT_BALANCE));
   json += JsonAddDouble("equity", AccountInfoDouble(ACCOUNT_EQUITY));
   json += JsonAddDouble("margin", AccountInfoDouble(ACCOUNT_MARGIN));
   json += JsonAddDouble("freeMargin", AccountInfoDouble(ACCOUNT_MARGIN_FREE));

   string tradesArr = JsonArrayStart();
   int total = PositionsTotal();
   for (int i = 0; i < total; i++) {
      ulong ticket = PositionGetTicket(i);
      if (ticket == 0) continue;

      long posType = PositionGetInteger(POSITION_TYPE);

      string t = JsonStart();
      t += JsonAddInt("ticket", (long)ticket);
      t += JsonAddString("symbol", PositionGetString(POSITION_SYMBOL));
      t += JsonAddString("direction", posType == POSITION_TYPE_BUY ? "BUY" : "SELL");
      t += JsonAddDouble("lots", PositionGetDouble(POSITION_VOLUME));
      t += JsonAddDouble("openPrice", PositionGetDouble(POSITION_PRICE_OPEN));
      t += JsonAddString("openTime", DateTimeToISO((datetime)PositionGetInteger(POSITION_TIME)));
      t += JsonAddDouble("stopLoss", PositionGetDouble(POSITION_SL));
      t += JsonAddDouble("takeProfit", PositionGetDouble(POSITION_TP));
      t += JsonAddDouble("profit", PositionGetDouble(POSITION_PROFIT));
      t += JsonAddDouble("currentPrice", PositionGetDouble(POSITION_PRICE_CURRENT));
      t += JsonAddDouble("swap", PositionGetDouble(POSITION_SWAP));
      t += JsonAddDouble("commission", 0);
      t += JsonAddInt("magicNumber", PositionGetInteger(POSITION_MAGIC));
      t += JsonAddString("comment", PositionGetString(POSITION_COMMENT));
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
      PanelShowConnected(
         AccountInfoString(ACCOUNT_COMPANY),
         AccountInfoInteger(ACCOUNT_LOGIN),
         AccountInfoDouble(ACCOUNT_BALANCE),
         AccountInfoString(ACCOUNT_CURRENCY));
      // Process any pending actions from server
      ProcessPendingActions(response);
   }
}

//+------------------------------------------------------------------+
//| Detect correct fill mode for the broker/symbol                     |
//+------------------------------------------------------------------+
ENUM_ORDER_TYPE_FILLING GetFillMode(string symbol) {
   long fillMode = SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
   if ((fillMode & SYMBOL_FILLING_FOK) != 0)
      return ORDER_FILLING_FOK;
   if ((fillMode & SYMBOL_FILLING_IOC) != 0)
      return ORDER_FILLING_IOC;
   return ORDER_FILLING_RETURN;
}

string g_ActionError = ""; // Captures the actual error from ExecuteMtAction

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

      Print("[EA Action] Processing: ", actionType, " ticket=", ticketStr, " id=", actionId);
      g_ActionError = "";
      ulong ticket = (ulong)StringToInteger(ticketStr);
      bool success = ExecuteMtAction(ticket, actionType, newValue);
      Print("[EA Action] Result: ", success ? "OK" : ("FAILED: " + g_ActionError));
      ReportActionResult(actionId, success);
   }
}

//+------------------------------------------------------------------+
//| Execute a trade action in MetaTrader 5                             |
//+------------------------------------------------------------------+
bool ExecuteMtAction(ulong ticket, string actionType, string newValue) {
   if (!PositionSelectByTicket(ticket)) {
      g_ActionError = "Position #" + IntegerToString(ticket) + " not found (err " + IntegerToString(GetLastError()) + ")";
      Print("[EA Action] ", g_ActionError);
      return false;
   }

   string symbol = PositionGetString(POSITION_SYMBOL);
   double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
   double currentSL = PositionGetDouble(POSITION_SL);
   double currentTP = PositionGetDouble(POSITION_TP);
   double lots = PositionGetDouble(POSITION_VOLUME);
   long posType = PositionGetInteger(POSITION_TYPE);

   MqlTradeRequest request;
   MqlTradeResult result;
   ZeroMemory(request);
   ZeroMemory(result);

   if (actionType == "SET_BE") {
      request.action = TRADE_ACTION_SLTP;
      request.position = ticket;
      request.symbol = symbol;
      request.sl = openPrice;
      request.tp = currentTP;
      bool ok = OrderSend(request, result);
      if (!ok || result.retcode != TRADE_RETCODE_DONE) {
         g_ActionError = "SET_BE retcode " + IntegerToString(result.retcode) + " " + result.comment;
         Print("[EA Action] ", g_ActionError);
         return false;
      }
      return true;
   }
   else if (actionType == "MOVE_SL") {
      double newSL = StringToDouble(newValue);
      if (newSL <= 0) {
         g_ActionError = "Invalid SL value: " + newValue;
         Print("[EA Action] ", g_ActionError);
         return false;
      }
      request.action = TRADE_ACTION_SLTP;
      request.position = ticket;
      request.symbol = symbol;
      request.sl = newSL;
      request.tp = currentTP;
      bool ok = OrderSend(request, result);
      if (!ok || result.retcode != TRADE_RETCODE_DONE) {
         g_ActionError = "MOVE_SL retcode " + IntegerToString(result.retcode) + " " + result.comment;
         Print("[EA Action] ", g_ActionError);
         return false;
      }
      return true;
   }
   else if (actionType == "CHANGE_TP") {
      double newTP = StringToDouble(newValue);
      if (newTP <= 0) {
         g_ActionError = "Invalid TP value: " + newValue;
         Print("[EA Action] ", g_ActionError);
         return false;
      }
      request.action = TRADE_ACTION_SLTP;
      request.position = ticket;
      request.symbol = symbol;
      request.sl = currentSL;
      request.tp = newTP;
      bool ok = OrderSend(request, result);
      if (!ok || result.retcode != TRADE_RETCODE_DONE) {
         g_ActionError = "CHANGE_TP retcode " + IntegerToString(result.retcode) + " " + result.comment;
         Print("[EA Action] ", g_ActionError);
         return false;
      }
      return true;
   }
   else if (actionType == "CLOSE") {
      request.action = TRADE_ACTION_DEAL;
      request.position = ticket;
      request.symbol = symbol;
      request.volume = lots;
      request.type = (posType == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
      request.price = (posType == POSITION_TYPE_BUY)
         ? SymbolInfoDouble(symbol, SYMBOL_BID)
         : SymbolInfoDouble(symbol, SYMBOL_ASK);
      request.deviation = 10;
      request.type_filling = GetFillMode(symbol);
      bool ok = OrderSend(request, result);
      if (!ok || result.retcode != TRADE_RETCODE_DONE) {
         g_ActionError = "CLOSE retcode " + IntegerToString(result.retcode) + " " + result.comment;
         Print("[EA Action] ", g_ActionError);
         return false;
      }
      return true;
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
      json += JsonAddString("errorMessage", g_ActionError != "" ? g_ActionError : ("MT5 error " + IntegerToString(GetLastError())));
   }
   JsonEnd(json);

   string response;
   int code = HttpPost("/api/ea/actions/" + actionId + "/result", json, response);
   if (code != 200) {
      Print("[EA Action] ReportActionResult failed, HTTP ", code);
   }
}

//+------------------------------------------------------------------+
//| Sync full trade history (MT5: reconstruct from deals)             |
//+------------------------------------------------------------------+
void SyncTradeHistory() {
   // Select history for last 90 days
   datetime from = TimeCurrent() - 90 * 86400;
   datetime to = TimeCurrent();
   HistorySelect(from, to);

   // Group deals by position ID to reconstruct trades
   int totalDeals = HistoryDealsTotal();

   // Track processed position IDs
   ulong processedPositions[];

   string tradesArr = JsonArrayStart();
   int count = 0;

   for (int i = 0; i < totalDeals && count < 5000; i++) {
      ulong dealTicket = HistoryDealGetTicket(i);
      if (dealTicket == 0) continue;

      long dealEntry = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      if (dealEntry != DEAL_ENTRY_OUT) continue; // Only process closing deals

      ulong posId = (ulong)HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);

      // Check if already processed
      bool processed = false;
      for (int j = 0; j < ArraySize(processedPositions); j++) {
         if (processedPositions[j] == posId) { processed = true; break; }
      }
      if (processed) continue;

      int sz = ArraySize(processedPositions);
      ArrayResize(processedPositions, sz + 1);
      processedPositions[sz] = posId;

      // Find the opening deal for this position
      double openPrice = 0;
      datetime openTime = 0;
      long dealType = 0;
      double lots = 0;
      string symbol = "";
      long magicNumber = 0;
      string comment = "";

      for (int k = 0; k < totalDeals; k++) {
         ulong dt = HistoryDealGetTicket(k);
         if (dt == 0) continue;
         if ((ulong)HistoryDealGetInteger(dt, DEAL_POSITION_ID) != posId) continue;
         if (HistoryDealGetInteger(dt, DEAL_ENTRY) == DEAL_ENTRY_IN) {
            openPrice = HistoryDealGetDouble(dt, DEAL_PRICE);
            openTime = (datetime)HistoryDealGetInteger(dt, DEAL_TIME);
            dealType = HistoryDealGetInteger(dt, DEAL_TYPE);
            lots = HistoryDealGetDouble(dt, DEAL_VOLUME);
            symbol = HistoryDealGetString(dt, DEAL_SYMBOL);
            magicNumber = HistoryDealGetInteger(dt, DEAL_MAGIC);
            comment = HistoryDealGetString(dt, DEAL_COMMENT);
            break;
         }
      }

      if (openTime == 0) continue;

      double closePrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
      datetime closeTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
      double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
      double commission = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
      double swap = HistoryDealGetDouble(dealTicket, DEAL_SWAP);

      string t = JsonStart();
      t += JsonAddInt("ticket", (long)posId);
      t += JsonAddString("symbol", symbol);
      t += JsonAddString("direction", dealType == DEAL_TYPE_BUY ? "BUY" : "SELL");
      t += JsonAddDouble("lots", lots);
      t += JsonAddDouble("openPrice", openPrice);
      t += JsonAddDouble("closePrice", closePrice);
      t += JsonAddString("openTime", DateTimeToISO(openTime));
      t += JsonAddString("closeTime", DateTimeToISO(closeTime));
      t += JsonAddDouble("profit", profit);
      t += JsonAddDouble("commission", commission);
      t += JsonAddDouble("swap", swap);
      t += JsonAddString("comment", comment);
      t += JsonAddInt("magicNumber", magicNumber);
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
//| Send position open event                                          |
//+------------------------------------------------------------------+
void SendPositionEvent(string eventType, ulong posTicket) {
   if (!PositionSelectByTicket(posTicket)) return;

   long posType = PositionGetInteger(POSITION_TYPE);

   string t = JsonStart();
   t += JsonAddInt("ticket", (long)posTicket);
   t += JsonAddString("symbol", PositionGetString(POSITION_SYMBOL));
   t += JsonAddString("direction", posType == POSITION_TYPE_BUY ? "BUY" : "SELL");
   t += JsonAddDouble("lots", PositionGetDouble(POSITION_VOLUME));
   t += JsonAddDouble("openPrice", PositionGetDouble(POSITION_PRICE_OPEN));
   t += JsonAddString("openTime", DateTimeToISO((datetime)PositionGetInteger(POSITION_TIME)));
   t += JsonAddDouble("stopLoss", PositionGetDouble(POSITION_SL));
   t += JsonAddDouble("takeProfit", PositionGetDouble(POSITION_TP));
   t += JsonAddDouble("profit", PositionGetDouble(POSITION_PROFIT));
   t += JsonAddDouble("swap", PositionGetDouble(POSITION_SWAP));
   t += JsonAddDouble("commission", 0);
   t += JsonAddInt("magicNumber", PositionGetInteger(POSITION_MAGIC));
   t += JsonAddString("comment", PositionGetString(POSITION_COMMENT));
   t += JsonAddBool("isOpen", true);
   JsonEnd(t);

   string json = JsonStart();
   json += JsonAddString("event", eventType);
   json += JsonAddRaw("trade", t);
   JsonEnd(json);

   string response;
   HttpPost("/api/ea/trade-event", json, response);
}

//+------------------------------------------------------------------+
//| Send closed trade from history deals                              |
//+------------------------------------------------------------------+
void SendClosedTradeFromHistory(ulong posId) {
   datetime from = TimeCurrent() - 86400; // Last 24h
   HistorySelect(from, TimeCurrent());

   double openPrice = 0, closePrice = 0, lots = 0, profit = 0, commission = 0, swap = 0;
   datetime openTime = 0, closeTime = 0;
   long dealType = 0, magicNumber = 0;
   string symbol = "", comment = "";

   int totalDeals = HistoryDealsTotal();
   for (int i = 0; i < totalDeals; i++) {
      ulong dt = HistoryDealGetTicket(i);
      if (dt == 0) continue;
      if ((ulong)HistoryDealGetInteger(dt, DEAL_POSITION_ID) != posId) continue;

      long entry = HistoryDealGetInteger(dt, DEAL_ENTRY);
      if (entry == DEAL_ENTRY_IN) {
         openPrice = HistoryDealGetDouble(dt, DEAL_PRICE);
         openTime = (datetime)HistoryDealGetInteger(dt, DEAL_TIME);
         dealType = HistoryDealGetInteger(dt, DEAL_TYPE);
         lots = HistoryDealGetDouble(dt, DEAL_VOLUME);
         symbol = HistoryDealGetString(dt, DEAL_SYMBOL);
         magicNumber = HistoryDealGetInteger(dt, DEAL_MAGIC);
         comment = HistoryDealGetString(dt, DEAL_COMMENT);
      }
      else if (entry == DEAL_ENTRY_OUT) {
         closePrice = HistoryDealGetDouble(dt, DEAL_PRICE);
         closeTime = (datetime)HistoryDealGetInteger(dt, DEAL_TIME);
         profit = HistoryDealGetDouble(dt, DEAL_PROFIT);
         commission = HistoryDealGetDouble(dt, DEAL_COMMISSION);
         swap = HistoryDealGetDouble(dt, DEAL_SWAP);
      }
   }

   if (openTime == 0 || closeTime == 0) return;

   string t = JsonStart();
   t += JsonAddInt("ticket", (long)posId);
   t += JsonAddString("symbol", symbol);
   t += JsonAddString("direction", dealType == DEAL_TYPE_BUY ? "BUY" : "SELL");
   t += JsonAddDouble("lots", lots);
   t += JsonAddDouble("openPrice", openPrice);
   t += JsonAddDouble("closePrice", closePrice);
   t += JsonAddString("openTime", DateTimeToISO(openTime));
   t += JsonAddString("closeTime", DateTimeToISO(closeTime));
   t += JsonAddDouble("profit", profit);
   t += JsonAddDouble("commission", commission);
   t += JsonAddDouble("swap", swap);
   t += JsonAddString("comment", comment);
   t += JsonAddInt("magicNumber", magicNumber);
   t += JsonAddBool("isOpen", false);
   JsonEnd(t);

   string json = JsonStart();
   json += JsonAddString("event", "close");
   json += JsonAddRaw("trade", t);
   JsonEnd(json);

   string response;
   HttpPost("/api/ea/trade-event", json, response);
}

//+------------------------------------------------------------------+
//| Cache current open position tickets                               |
//+------------------------------------------------------------------+
void CacheOpenPositions() {
   ArrayResize(g_KnownPositions, 0);
   int total = PositionsTotal();
   for (int i = 0; i < total; i++) {
      ulong ticket = PositionGetTicket(i);
      if (ticket == 0) continue;
      int sz = ArraySize(g_KnownPositions);
      ArrayResize(g_KnownPositions, sz + 1);
      g_KnownPositions[sz] = ticket;
   }
}
//+------------------------------------------------------------------+
