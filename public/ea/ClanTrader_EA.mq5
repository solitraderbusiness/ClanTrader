//+------------------------------------------------------------------+
//| ClanTrader_EA.mq5 — MetaTrader 5 Expert Advisor                |
//| Connects MT5 to ClanTrader platform                             |
//| Single-file build: no external includes needed                  |
//+------------------------------------------------------------------+
#property copyright "ClanTrader"
#property link      "https://clantrader.ir"
#property version   "1.00"

//====================================================================
//  JSON HELPERS
//====================================================================

string JsonStart() { return "{"; }
string JsonEnd(string &json) {
   if (StringGetCharacter(json, StringLen(json)-1) == ',')
      json = StringSubstr(json, 0, StringLen(json)-1);
   json += "}";
   return json;
}

string JsonArrayStart() { return "["; }
string JsonArrayEnd(string &json) {
   if (StringLen(json) > 1 && StringGetCharacter(json, StringLen(json)-1) == ',')
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

string JsonAddInt(string key, long value) {
   return "\"" + key + "\":" + IntegerToString(value) + ",";
}

string JsonAddDouble(string key, double value) {
   return "\"" + key + "\":" + DoubleToString(value, 5) + ",";
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
      ushort ch = StringGetCharacter(json, end);
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

   if (StringGetCharacter(jsonArray, 0) == '[')
      jsonArray = StringSubstr(jsonArray, 1, len - 2);

   len = StringLen(jsonArray);
   int count = 0;
   int depth = 0;
   int start = 0;

   for (int i = 0; i < len && count < maxItems; i++) {
      ushort ch = StringGetCharacter(jsonArray, i);
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
   MqlDateTime mdt;
   TimeToStruct(dt, mdt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
      mdt.year, mdt.mon, mdt.day, mdt.hour, mdt.min, mdt.sec);
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

void PanelShowConnected(string broker, long acctNum, double balance, string currency) {
   PanelSetStatus("Connected", CLR_OK);
   string info = broker + " #" + IntegerToString(acctNum)
               + " | " + DoubleToString(balance, 2) + " " + currency;
   PanelSetAccountInfo(info);
}

//====================================================================
//  EA MAIN
//====================================================================

input string InpBaseUrl = "https://clantrader.com"; // Server URL

bool     g_Connected = false;
ulong    g_KnownPositions[];
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
   // Trade events handled via OnTradeTransaction
}

void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result) {
   if (!g_Connected) return;

   if (trans.type == TRADE_TRANSACTION_DEAL_ADD) {
      if (!HistoryDealSelect(trans.deal)) return;
      long entry = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);

      if (entry == DEAL_ENTRY_IN) {
         ulong posId = (ulong)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
         if (PositionSelectByTicket(posId))
            SendPositionEvent("open", posId);
      }
      else if (entry == DEAL_ENTRY_OUT) {
         ulong posId = (ulong)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
         SendClosedTradeFromHistory(posId);
      }
   }
   else if (trans.type == TRADE_TRANSACTION_REQUEST) {
      if (request.action == TRADE_ACTION_SLTP && request.position > 0) {
         if (PositionSelectByTicket(request.position))
            SendPositionEvent("modify", request.position);
      }
   }
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
//| Heartbeat                                                          |
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
      ulong ticket = (ulong)StringToInteger(ticketStr);
      bool success = ExecuteMtAction(ticket, actionType, newValue);
      Print("[EA Action] Result: ", success ? "OK" : "FAILED");
      ReportActionResult(actionId, success);
   }
}

//+------------------------------------------------------------------+
//| Execute a trade action in MetaTrader 5                             |
//+------------------------------------------------------------------+
bool ExecuteMtAction(ulong ticket, string actionType, string newValue) {
   g_ActionError = "";

   if (!PositionSelectByTicket(ticket)) {
      g_ActionError = "Failed to select position #" + IntegerToString(ticket);
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
//| Sync trade history (MT5: reconstruct from deals)                  |
//+------------------------------------------------------------------+
void SyncTradeHistory() {
   datetime from = TimeCurrent() - 90 * 86400;
   datetime to = TimeCurrent();
   HistorySelect(from, to);

   int totalDeals = HistoryDealsTotal();
   ulong processedPositions[];
   string tradesArr = JsonArrayStart();
   int count = 0;

   for (int i = 0; i < totalDeals && count < 5000; i++) {
      ulong dealTicket = HistoryDealGetTicket(i);
      if (dealTicket == 0) continue;
      long dealEntry = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      if (dealEntry != DEAL_ENTRY_OUT) continue;

      ulong posId = (ulong)HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);

      bool processed = false;
      for (int j = 0; j < ArraySize(processedPositions); j++) {
         if (processedPositions[j] == posId) { processed = true; break; }
      }
      if (processed) continue;

      int sz = ArraySize(processedPositions);
      ArrayResize(processedPositions, sz + 1);
      processedPositions[sz] = posId;

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
//| Send closed trade from history                                    |
//+------------------------------------------------------------------+
void SendClosedTradeFromHistory(ulong posId) {
   datetime from = TimeCurrent() - 86400;
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
//| Cache open positions                                               |
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
