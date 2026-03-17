//+------------------------------------------------------------------+
//| ClanTrader_JSON.mqh — Minimal JSON builder/parser for MQL5       |
//+------------------------------------------------------------------+
#property copyright "ClanTrader"

//--- Simple JSON builder ---

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

//--- JSON array splitter ---

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

//--- DateTime conversion: MQL5 → ISO 8601 ---

string DateTimeToISO(datetime dt) {
   MqlDateTime mdt;
   TimeToStruct(dt, mdt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
      mdt.year, mdt.mon, mdt.day, mdt.hour, mdt.min, mdt.sec);
}
