//+------------------------------------------------------------------+
//| ClanTrader_JSON.mqh — Minimal JSON builder/parser for MQL4       |
//+------------------------------------------------------------------+
#property copyright "ClanTrader"
#property strict

//--- Simple JSON builder ---

string JsonStart() { return "{"; }
string JsonEnd(string &json) {
   // Remove trailing comma
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

string EscapeJson(string s) {
   string result = s;
   StringReplace(result, "\\", "\\\\");
   StringReplace(result, "\"", "\\\"");
   StringReplace(result, "\n", "\\n");
   StringReplace(result, "\r", "\\r");
   StringReplace(result, "\t", "\\t");
   return result;
}

//--- Simple JSON value extraction ---

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
   // For non-string values (numbers, bools, objects)
   string search = "\"" + key + "\":";
   int pos = StringFind(json, search);
   if (pos < 0) return "";
   int start = pos + StringLen(search);
   // Find end: comma, }, or ]
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

//--- JSON array splitter ---

// Split a JSON array string into individual elements.
// Input: "[{...},{...}]"  Output: array of "{...}" strings
int SplitJsonArray(string jsonArray, string &items[], int maxItems = 20) {
   ArrayResize(items, 0);
   int len = StringLen(jsonArray);
   if (len < 2) return 0;

   // Strip outer brackets
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

   // Last element
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

//--- DateTime conversion: MQL4 → ISO 8601 ---

string DateTimeToISO(datetime dt) {
   return TimeToStr(dt, TIME_DATE) + "T" + TimeToStr(dt, TIME_SECONDS) + "Z";
}
