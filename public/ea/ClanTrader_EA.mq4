//+------------------------------------------------------------------+
//| ClanTrader_EA.mq4 — MetaTrader 4 Expert Advisor                |
//| Connects MT4 to ClanTrader platform                             |
//| Single-file build: no external includes needed                  |
//+------------------------------------------------------------------+
#property copyright "ClanTrader"
#property link      "https://clantrader.ir"
#property version   "1.00"
#property strict

//====================================================================
//  JSON HELPERS
//====================================================================

string JsonStart() { return "{"; }
string JsonEnd(string &json) {
   if (StringGetChar(json, StringLen(json)-1) == ',')
      json = StringSubstr(json, 0, StringLen(json)-1);
   json += "}";
   return json;
}

string JsonArrayStart() { return "["; }
string JsonArrayEnd(string &json) {
   if (StringLen(json) > 1 && StringGetChar(json, StringLen(json)-1) == ',')
      json = StringSubstr(json, 0, StringLen(json)-1);
   json += "]";
   return json;
}

string EscapeJson(string s) {
   string result = s;
   StringReplace(result, "\\", "\\\\");
   StringReplace(result, "\"", "\\\"");
   StringReplace(result, "\n", "\\n");
   StringReplace(result, "\r", "\\r");
   StringReplace(result, "\t", "\\t");
   return result;
}

string JsonAddString(string key, string value) {
   return "\"" + key + "\":\"" + EscapeJson(value) + "\",";
}

string JsonAddInt(string key, int value) {
   return "\"" + key + "\":" + IntegerToString(value) + ",";
}

string JsonAddDouble(string key, double value) {
   return "\"" + key + "\":" + DoubleToStr(value, 5) + ",";
}

string JsonAddBool(string key, bool value) {
   return "\"" + key + "\":" + (value ? "true" : "false") + ",";
}

string JsonAddRaw(string key, string rawJson) {
   return "\"" + key + "\":" + rawJson + ",";
}

string JsonGetString(string json, string key) {
   string search = "\"" + key + "\":\"";
   int pos = StringFind(json, search);
   if (pos < 0) return "";
   int start = pos + StringLen(search);
   int end = StringFind(json, "\"", start);
   if (end < 0) return "";
   return StringSubstr(json, start, end - start);
}

string JsonGetValue(string json, string key) {
   string search = "\"" + key + "\":";
   int pos = StringFind(json, search);
   if (pos < 0) return "";
   int start = pos + StringLen(search);
   int end = start;
   int len = StringLen(json);
   int depth = 0;
   while (end < len) {
      int ch = StringGetChar(json, end);
      if (ch == '{' || ch == '[') depth++;
      else if (ch == '}' || ch == ']') {
         if (depth == 0) break;
         depth--;
      }
      else if (ch == ',' && depth == 0) break;
      end++;
   }
   return StringSubstr(json, start, end - start);
}

int SplitJsonArray(string jsonArray, string &items[], int maxItems = 20) {
   ArrayResize(items, 0);
   int len = StringLen(jsonArray);
   if (len < 2) return 0;

   if (StringGetChar(jsonArray, 0) == '[')
      jsonArray = StringSubstr(jsonArray, 1, len - 2);

   len = StringLen(jsonArray);
   int count = 0;
   int depth = 0;
   int start = 0;

   for (int i = 0; i < len && count < maxItems; i++) {
      int ch = StringGetChar(jsonArray, i);
      if (ch == '{' || ch == '[') depth++;
      else if (ch == '}' || ch == ']') depth--;
      else if (ch == ',' && depth == 0) {
         string item = StringSubstr(jsonArray, start, i - start);
         StringTrimLeft(item);
         StringTrimRight(item);
         if (StringLen(item) > 0) {
            int sz = ArraySize(items);
            ArrayResize(items, sz + 1);
            items[sz] = item;
            count++;
         }
         start = i + 1;
      }
   }

   if (start < len && count < maxItems) {
      string last = StringSubstr(jsonArray, start, len - start);
      StringTrimLeft(last);
      StringTrimRight(last);
      if (StringLen(last) > 0) {
         int sz = ArraySize(items);
         ArrayResize(items, sz + 1);
         items[sz] = last;
         count++;
      }
   }

   return count;
}

string DateTimeToISO(datetime dt) {
   return TimeToStr(dt, TIME_DATE) + "T" + TimeToStr(dt, TIME_SECONDS) + "Z";
}

//====================================================================
//  HTTP HELPERS
//====================================================================

string g_BaseUrl = "https://clantrader.com";
string g_ApiKey = "";
string g_ActionError = "";
int    g_HttpTimeout = 10000;

void SetBaseUrl(string url)   { g_BaseUrl = url; }
void SetApiKey(string key)    { g_ApiKey = key; }

int HttpPost(string endpoint, string jsonBody, string &response) {
   string url = g_BaseUrl + endpoint;
   string headers = "Content-Type: application/json\r\n";
   if (g_ApiKey != "")
      headers += "Authorization: Bearer " + g_ApiKey + "\r\n";

   char post[];
   char result[];
   string resultHeaders;

   StringToCharArray(jsonBody, post, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(post, ArraySize(post) - 1);

   int httpCode = WebRequest(
      "POST", url, headers, g_HttpTimeout, post, result, resultHeaders);

   if (httpCode == -1) {
      int err = GetLastError();
      response = "{\"error\":\"WebRequest failed, code " + IntegerToString(err)
               + ". Add " + g_BaseUrl + " to allowed URLs.\"}";
      return -1;
   }

   response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return httpCode;
}

int HttpGet(string endpoint, string &response) {
   string url = g_BaseUrl + endpoint;
   string headers = "";
   if (g_ApiKey != "")
      headers = "Authorization: Bearer " + g_ApiKey + "\r\n";

   char post[];
   char result[];
   string resultHeaders;

   int httpCode = WebRequest(
      "GET", url, headers, g_HttpTimeout, post, result, resultHeaders);

   if (httpCode == -1) {
      int err = GetLastError();
      response = "{\"error\":\"WebRequest failed, code " + IntegerToString(err) + "\"}";
      return -1;
   }

   response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return httpCode;
}

//====================================================================
//  PANEL UI
//====================================================================

#define PANEL_BG         "CT_PanelBG"
#define PANEL_TITLE      "CT_Title"
#define PANEL_USER_LABEL "CT_UserLabel"
#define PANEL_USER_INPUT "CT_UserInput"
#define PANEL_PASS_LABEL "CT_PassLabel"
#define PANEL_PASS_INPUT "CT_PassInput"
#define PANEL_BTN_LOGIN  "CT_BtnLogin"
#define PANEL_BTN_REG    "CT_BtnRegister"
#define PANEL_STATUS     "CT_Status"
#define PANEL_ACCT_INFO  "CT_AcctInfo"

#define PANEL_X     20
#define PANEL_Y     30
#define PANEL_W     260
#define PANEL_H     280

#define CLR_BG      C'30,30,40'
#define CLR_BORDER  C'60,60,80'
#define CLR_TEXT    clrWhite
#define CLR_LABEL  clrLightGray
#define CLR_INPUT  C'50,50,65'
#define CLR_BTN    C'45,120,220'
#define CLR_BTN2   C'80,80,100'
#define CLR_OK     clrLime
#define CLR_ERR    clrRed

void CreateLabel(string name, int x, int y, string text, color clr, int fontSize) {
   ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, fontSize);
}

void CreateEdit(string name, int x, int y, int w, int h, string text) {
   ObjectCreate(0, name, OBJ_EDIT, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE, w);
   ObjectSetInteger(0, name, OBJPROP_YSIZE, h);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, CLR_INPUT);
   ObjectSetInteger(0, name, OBJPROP_COLOR, CLR_TEXT);
   ObjectSetInteger(0, name, OBJPROP_BORDER_COLOR, CLR_BORDER);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 10);
}

void CreateButton(string name, int x, int y, int w, int h, string text, color bgClr) {
   ObjectCreate(0, name, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE, w);
   ObjectSetInteger(0, name, OBJPROP_YSIZE, h);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, bgClr);
   ObjectSetInteger(0, name, OBJPROP_COLOR, CLR_TEXT);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 10);
}

void PanelCreate() {
   ObjectCreate(0, PANEL_BG, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, PANEL_BG, OBJPROP_XDISTANCE, PANEL_X);
   ObjectSetInteger(0, PANEL_BG, OBJPROP_YDISTANCE, PANEL_Y);
   ObjectSetInteger(0, PANEL_BG, OBJPROP_XSIZE, PANEL_W);
   ObjectSetInteger(0, PANEL_BG, OBJPROP_YSIZE, PANEL_H);
   ObjectSetInteger(0, PANEL_BG, OBJPROP_BGCOLOR, CLR_BG);
   ObjectSetInteger(0, PANEL_BG, OBJPROP_BORDER_COLOR, CLR_BORDER);
   ObjectSetInteger(0, PANEL_BG, OBJPROP_CORNER, CORNER_LEFT_UPPER);

   CreateLabel(PANEL_TITLE, PANEL_X + 10, PANEL_Y + 10, "ClanTrader EA", CLR_TEXT, 12);
   CreateLabel(PANEL_USER_LABEL, PANEL_X + 10, PANEL_Y + 40, "Username:", CLR_LABEL, 9);
   CreateEdit(PANEL_USER_INPUT, PANEL_X + 10, PANEL_Y + 58, 240, 22, "");
   CreateLabel(PANEL_PASS_LABEL, PANEL_X + 10, PANEL_Y + 90, "Password:", CLR_LABEL, 9);
   CreateEdit(PANEL_PASS_INPUT, PANEL_X + 10, PANEL_Y + 108, 240, 22, "");
   CreateButton(PANEL_BTN_LOGIN, PANEL_X + 10, PANEL_Y + 145, 115, 30, "Login", CLR_BTN);
   CreateButton(PANEL_BTN_REG, PANEL_X + 135, PANEL_Y + 145, 115, 30, "Register", CLR_BTN2);
   CreateLabel(PANEL_STATUS, PANEL_X + 10, PANEL_Y + 185, "Disconnected", CLR_LABEL, 9);
   CreateLabel(PANEL_ACCT_INFO, PANEL_X + 10, PANEL_Y + 210, " ", CLR_LABEL, 8);
   ChartRedraw();
}

void PanelDestroy() {
   ObjectDelete(0, PANEL_BG);
   ObjectDelete(0, PANEL_TITLE);
   ObjectDelete(0, PANEL_USER_LABEL);
   ObjectDelete(0, PANEL_USER_INPUT);
   ObjectDelete(0, PANEL_PASS_LABEL);
   ObjectDelete(0, PANEL_PASS_INPUT);
   ObjectDelete(0, PANEL_BTN_LOGIN);
   ObjectDelete(0, PANEL_BTN_REG);
   ObjectDelete(0, PANEL_STATUS);
   ObjectDelete(0, PANEL_ACCT_INFO);
   ChartRedraw();
}

string PanelGetUsername() {
   return ObjectGetString(0, PANEL_USER_INPUT, OBJPROP_TEXT);
}

string PanelGetPassword() {
   return ObjectGetString(0, PANEL_PASS_INPUT, OBJPROP_TEXT);
}

void PanelSetStatus(string text, color clr = CLR_LABEL) {
   ObjectSetString(0, PANEL_STATUS, OBJPROP_TEXT, text);
   ObjectSetInteger(0, PANEL_STATUS, OBJPROP_COLOR, clr);
   ChartRedraw();
}

void PanelSetAccountInfo(string text) {
   ObjectSetString(0, PANEL_ACCT_INFO, OBJPROP_TEXT, text);
   ChartRedraw();
}

void PanelShowConnected(string broker, int acctNum, double balance, string currency) {
   PanelSetStatus("Connected", CLR_OK);
   string info = broker + " #" + IntegerToString(acctNum)
               + " | " + DoubleToStr(balance, 2) + " " + currency;
   PanelSetAccountInfo(info);
}

//====================================================================
//  EA MAIN
//====================================================================

input string InpBaseUrl = "https://clantrader.com"; // Server URL

bool     g_Connected = false;
int      g_KnownTickets[];
double   g_KnownSL[];
double   g_KnownTP[];
datetime g_LastHistorySync = 0;
int      g_TimerTick = 0;

int OnInit() {
   SetBaseUrl(InpBaseUrl);
   PanelCreate();
   EventSetTimer(3);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {
   EventKillTimer();
   PanelDestroy();
}

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

void OnTick() {
   if (!g_Connected) return;
   DetectTradeChanges();
}

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
//| Login                                                              |
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

      CacheOpenTickets();

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
//| Register                                                           |
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
//| Heartbeat                                                          |
//+------------------------------------------------------------------+
void SendHeartbeat() {
   string json = JsonStart();
   json += JsonAddDouble("balance", AccountBalance());
   json += JsonAddDouble("equity", AccountEquity());
   json += JsonAddDouble("margin", AccountMargin());
   json += JsonAddDouble("freeMargin", AccountFreeMargin());

   string tradesArr = JsonArrayStart();
   int total = OrdersTotal();
   for (int i = 0; i < total; i++) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if (OrderType() > OP_SELL) continue;

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

      Print("[EA Action] Processing: ", actionType, " ticket=", ticketStr, " id=", actionId);
      int ticket = (int)StringToInteger(ticketStr);
      bool success = ExecuteMtAction(ticket, actionType, newValue);
      Print("[EA Action] Result: ", success ? "OK" : "FAILED");
      ReportActionResult(actionId, success);
   }
}

//+------------------------------------------------------------------+
//| Execute a trade action in MetaTrader 4                             |
//+------------------------------------------------------------------+
bool ExecuteMtAction(int ticket, string actionType, string newValue) {
   g_ActionError = "";

   if (!OrderSelect(ticket, SELECT_BY_TICKET, MODE_TRADES)) {
      g_ActionError = "Failed to select ticket #" + IntegerToString(ticket);
      Print("[EA Action] ", g_ActionError);
      return false;
   }

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
   int code = HttpPost("/api/ea/actions/" + actionId + "/result", json, response);
   if (code != 200) {
      Print("[EA Action] ReportActionResult failed, HTTP ", code);
   }
}

//+------------------------------------------------------------------+
//| Sync trade history                                                 |
//+------------------------------------------------------------------+
void SyncTradeHistory() {
   string tradesArr = JsonArrayStart();
   int total = OrdersHistoryTotal();
   int count = 0;

   for (int i = 0; i < total && count < 5000; i++) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) continue;
      if (OrderType() > OP_SELL) continue;

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
//| Send trade event                                                   |
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
//| Detect trade changes                                               |
//+------------------------------------------------------------------+
void DetectTradeChanges() {
   int currentTickets[];
   double currentSL[];
   double currentTP[];
   int total = OrdersTotal();

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

   // New trades
   for (int i = 0; i < ArraySize(currentTickets); i++) {
      bool found = false;
      for (int j = 0; j < ArraySize(g_KnownTickets); j++) {
         if (currentTickets[i] == g_KnownTickets[j]) { found = true; break; }
      }
      if (!found) SendTradeEvent("open", currentTickets[i]);
   }

   // Closed trades
   for (int i = 0; i < ArraySize(g_KnownTickets); i++) {
      bool found = false;
      for (int j = 0; j < ArraySize(currentTickets); j++) {
         if (g_KnownTickets[i] == currentTickets[j]) { found = true; break; }
      }
      if (!found) {
         if (OrderSelect(g_KnownTickets[i], SELECT_BY_TICKET))
            SendTradeEvent("close", g_KnownTickets[i]);
      }
   }

   // SL/TP modifications
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

   ArrayResize(g_KnownTickets, ArraySize(currentTickets));
   ArrayResize(g_KnownSL, ArraySize(currentTickets));
   ArrayResize(g_KnownTP, ArraySize(currentTickets));
   ArrayCopy(g_KnownTickets, currentTickets);
   ArrayCopy(g_KnownSL, currentSL);
   ArrayCopy(g_KnownTP, currentTP);
}

//+------------------------------------------------------------------+
//| Cache open tickets                                                 |
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
