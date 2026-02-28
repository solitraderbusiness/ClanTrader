//+------------------------------------------------------------------+
//| ClanTrader_Panel.mqh — Panel UI for MQL5                        |
//+------------------------------------------------------------------+
#property copyright "ClanTrader"

//--- Panel object names ---
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

//--- Panel dimensions ---
#define PANEL_X     20
#define PANEL_Y     30
#define PANEL_W     260
#define PANEL_H     280

//--- Colors ---
#define CLR_BG      C'30,30,40'
#define CLR_BORDER  C'60,60,80'
#define CLR_TEXT    clrWhite
#define CLR_LABEL  clrLightGray
#define CLR_INPUT  C'50,50,65'
#define CLR_BTN    C'45,120,220'
#define CLR_BTN2   C'80,80,100'
#define CLR_OK     clrLime
#define CLR_ERR    clrRed

//--- Create the panel ---
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

//--- Helpers ---
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
