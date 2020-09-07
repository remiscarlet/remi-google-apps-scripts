var API_KEY = "V3HQGB2GWX4EDOVD"; // I mean if you really want to steal a free API key I can renew in 5 seconds 😗

// ========================= helpers

function javascriptIsAFuckingTerribleLanguageGiveMeAFuckingDateFormatFunctionYouNitwits(date) {
  // Fuck you javascript your native datetime support is fucking cancer. WHY DO YOU MIX 1 AND 0 BASED INDICES.
  // Returns 'yyyy-mm-dd' formatted string for given date.
  // Cancer.jpg
  var year = date.getFullYear();
  var month = (date.getMonth()+1).toString().padStart(2, '0');
  var day = date.getDate().toString().padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// ========================= alphavantage

function buildAlphaVantageUrl(func_name, ticker_symbol, extra_params) {
  params = {
    "function": func_name,
    "symbol": ticker_symbol,
    "apikey": API_KEY,
    ...extra_params, // Hey spread operator is p cool
  };
  
  console.log(params);
  var query_string = Object.keys(params).map((key) => {
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key])
  }).join('&');
  // console.log(query_string);

  return `https://www.alphavantage.co/query?${query_string}`;
}

CACHE = CacheService.getScriptCache();
DEFAULT_CACHE_TTL = 60;
function getAlphaVantageData(func_name, ticker_symbol, extra_params = {}) {
  var url = buildAlphaVantageUrl(func_name, ticker_symbol, extra_params);
  var content = "";
  
  content = CACHE.get(url+"noup");
  if (content === null) {
    console.log("NO CACHE HIT. QUERYING.")
    console.log("Querying... "+url);
    var resp = UrlFetchApp.fetch(url);
    content = resp.getContentText();
    try {
      CACHE.put(url, content, DEFAULT_CACHE_TTL);
    } catch(err) {
      console.log("Failed to cache response from url. Response likely too large. (INTRADAY?)");
    }
  } else {
    console.log("FOUND CACHE HIT FOR "+url);
    console.log("FOUND... "+content);
  }
  
  console.log("Got response... "+content.substring(0, 500));
  
  var json_data = JSON.parse(content);
  return json_data;
}

function getAlphaVantageDaily(ticker) {
  var func_name = "TIME_SERIES_DAILY";
  return getAlphaVantageData(func_name, ticker);
}

function getAlphaVantageIntra(ticker) {
  var func_name = "TIME_SERIES_INTRADAY";
  var params = {"interval": "5min"};
  return getAlphaVantageData(func_name, ticker, params);
}

function getAlphaVantageCrypto(ticker, market) {
  var func_name = "DIGITAL_CURRENCY_DAILY";
  var params = {"market": market};
  return getAlphaVantageData(func_name, ticker, params);
}

// Data manip helpers

function extractNewestDataPoint(json_data) {
  var time_series_re = /Time Series/;
  for (var key_name in json_data) {
    if (time_series_re.test(key_name)) {
      var date = new Date();
      var target_date = "";
      
      do {
        // Since the last date in the response isn't guaranteed to be x days before due to weekends, holidays, etc,
        // Just start from checking existance of previous day and continue stepping back one day at a time.
        // Probably faster than getting object keys, sorting, then [-1]'ing that. Decrement date after getting
        // string incase the most recent day is "today".
        target_date = javascriptIsAFuckingTerribleLanguageGiveMeAFuckingDateFormatFunctionYouNitwits(date)
        date.setDate(date.getDate()-1);
      } while (!(target_date in json_data[key_name]));
      
      // console.log("Extracting data from date: "+target_date);
      return json_data[key_name][target_date];
    }
  }
  // throw Exception("Could not find 'Time Series' field in json data");
}

/** More specifically removes string indices from keynames
 * `1. open` => `open` etc
 */
function cleanAVPriceObjKeynames(json_data) {
  var obj = {};
  var key_extract_re = /\d+[a-z]?\.\s+(.*)(?:\s+\(.*\))?/
  
  for (var key in json_data) {
    var cleaned_key = (key.match(key_extract_re) || [ "", "ERROR" ])[1];
    obj[cleaned_key] = json_data[key];
    console.log({"cleaned_key": cleaned_key, "key": key, 'val': obj[cleaned_key]});
  }  
  return obj;
}

function extractLatestDataPointAsObj(json_data) {
  var data_point = extractNewestDataPoint(json_data);
  var obj = cleanAVPriceObjKeynames(data_point);
  return obj;
}

API_FAILED_ERR = "[ERR: API FAILURE]";
function generateCellArr(ticker, data) {
  var cell_arr = []; // Array of cells to return which will represent cells of values in the sheet.
  var val = parseFloat(data["close"]);
  
  cell_arr.push(isNaN(val) ? API_FAILED_ERR : val);
  if (isNaN(val)) {
    val = CACHE.get(ticker)
  } else {
    CACHE.put(ticker, val, 3600);
  }
  cell_arr.push(val);
  
  return cell_arr;
}

/** 
 * A valid ticker symbol is defined by the regex: /^[A-Z]+$/
 * This function sanitizes the ticker string so it validates for above regex.
 * Will remove things like parenthesis, asterisks, and other human formatting helpers
 * REQUIREMENT: Ticker string must start with true ticker string. Ie, only use custom suffixes and not prefixes.
 */
function sanitizeTickerStr(ticker) {
  validation_re = /(^[A-Z]+)/;
  if (validation_re.test(ticker)) {
    return ticker.match(validation_re)[1];
  } else {
    throw Exception("Could not validate input ticker string as valid. Using regex: "+validation_re);
  }
}

// ========================= stonks

function getStockMetric(ticker) {
  console.log("getStockMetric(" + ticker + ")");
  console.log(typeof(ticker));
  var daily_data = extractLatestDataPointAsObj(getAlphaVantageDaily(ticker));
  //var intra_data = extractLatestDataPointAsObj(getAlphaVantageIntra(ticker));

  return generateCellArr(ticker, daily_data);
}

function getStockMetrics(tickers_arr) {
  rtn_data = [];
  if (typeof(tickers_arr) === "string") {
    tickers_arr = [[tickers_arr]];
  }

  tickers_arr.forEach((ticker) => {
    console.log("Getting metrics for... "+ticker);
    var ticker_sanitized = sanitizeTickerStr(ticker[0]);
    data = getStockMetric(ticker_sanitized)
    rtn_data.push(data);
    console.log("Metrics: "+data);
  });
    
  return rtn_data;
}

function test_getStockMetrics() {
  var data = getStockMetrics("VWO");
  console.log(data);
  return data;
}

// ========================= crypto

function getCryptoMetric(ticker, market) {
  data = extractLatestDataPointAsObj(getAlphaVantageCrypto(ticker, market));
  return generateCellArr(ticker, data);
}

function getCryptoMetrics(tickers_arr, market="USD") {
  rtn_data = [];
  
  if (typeof(tickers_arr) === "string") {
    tickers_arr = [tickers_arr];
  }
  
  tickers_arr.forEach((ticker) => {
    console.log("Getting metrics for... "+ticker);
    var ticker_sanitized = sanitizeTickerStr(ticker[0]);
    data = getCryptoMetric(ticker_sanitized, market);
    rtn_data.push(data);
    console.log("Metrics: "+data);
  });
  
  return rtn_data;
}

// ========================= debug

function TEST(input) {
  return (JSON.stringify(input));
}
