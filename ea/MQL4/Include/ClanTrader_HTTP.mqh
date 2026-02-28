//+------------------------------------------------------------------+
//| ClanTrader_HTTP.mqh — WebRequest wrapper for MQL4               |
//+------------------------------------------------------------------+
#property copyright "ClanTrader"
#property strict

#include "ClanTrader_JSON.mqh"

//--- Configuration ---
string g_BaseUrl = "https://clantrader.ir";
string g_ApiKey = "";
int    g_HttpTimeout = 10000; // 10 seconds

void SetBaseUrl(string url)   { g_BaseUrl = url; }
void SetApiKey(string key)    { g_ApiKey = key; }

//--- HTTP POST with JSON body ---

int HttpPost(string endpoint, string jsonBody, string &response) {
   string url = g_BaseUrl + endpoint;
   string headers = "Content-Type: application/json\r\n";
   if (g_ApiKey != "")
      headers += "Authorization: Bearer " + g_ApiKey + "\r\n";

   char post[];
   char result[];
   string resultHeaders;

   StringToCharArray(jsonBody, post, 0, WHOLE_ARRAY, CP_UTF8);
   // Remove null terminator from char array
   ArrayResize(post, ArraySize(post) - 1);

   int httpCode = WebRequest(
      "POST",
      url,
      headers,
      g_HttpTimeout,
      post,
      result,
      resultHeaders
   );

   if (httpCode == -1) {
      int err = GetLastError();
      response = "{\"error\":\"WebRequest failed, code " + IntegerToString(err) + ". Add " + g_BaseUrl + " to allowed URLs.\"}";
      return -1;
   }

   response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return httpCode;
}

//--- HTTP GET ---

int HttpGet(string endpoint, string &response) {
   string url = g_BaseUrl + endpoint;
   string headers = "";
   if (g_ApiKey != "")
      headers = "Authorization: Bearer " + g_ApiKey + "\r\n";

   char post[];
   char result[];
   string resultHeaders;

   int httpCode = WebRequest(
      "GET",
      url,
      headers,
      g_HttpTimeout,
      post,
      result,
      resultHeaders
   );

   if (httpCode == -1) {
      int err = GetLastError();
      response = "{\"error\":\"WebRequest failed, code " + IntegerToString(err) + "\"}";
      return -1;
   }

   response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return httpCode;
}
