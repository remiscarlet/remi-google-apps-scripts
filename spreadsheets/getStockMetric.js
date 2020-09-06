var API_KEY = "V3HQGB2GWX4EDOVD";

function javascriptIsAFuckingTerribleLanguageGiveMeAFuckingDateFormatFunctionYouNitwits(date) {
  // Fuck you javascript your native datetime support is fucking cancer. WHY DO YOU MIX 1 AND 0 BASED INDICES.
  // Returns 'yyyy-mm-dd' formatted string for given date.
  // Google apps scripts so no moment.js natively. Need to look into library project keys
  var year = date.getFullYear();
  var month = (date.getMonth()+1).toString().padStart(2, '0');
  var day = date.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}


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
  console.log(query_string);

  return `https://www.alphavantage.co/query?${query_string}`;
}

function getAlphaVantageData(func_name, ticker_symbol, extra_params = {}) {
  var url = buildAlphaVantageUrl(func_name, ticker_symbol, extra_params);
  console.log("Querying... "+url);
  var resp = UrlFetchApp.fetch(url);
  var json_data = JSON.parse(resp.getContentText());
  // console.log(Object.keys(json_data));
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


function getStockMetrics2(ticker) {
  var json_obj = getAlphaVantageDaily(ticker);
  return json_obj["Meta Data"]["1. Information"];
}


function extractNewestDataPoint(json_data) {
  var time_series_re = /Time Series/;
  for (var key_name in json_data) {
    if (time_series_re.test(key_name)) {
      var date = new Date();
      var target_date = "";

      do {
        // Since the last date in the response isn't guaranteed to be x days before due to weekends, holidays, etc,
        // Just start from checking existance of previous day and continue stepping back one day at a time.
        // Probably faster than getting object keys, sorting, then [-1]'ing that.
        date.setDate(date.getDate()-1);
        target_date = javascriptIsAFuckingTerribleLanguageGiveMeAFuckingDateFormatFunctionYouNitwits(date)
      } while (!(target_date in json_data[key_name]));

      // console.log("Extracting data from date: "+target_date);
      return json_data[key_name][target_date];
    }
  }
  // throw Exception("Could not find 'Time Series' field in json data");
}

function cleanAVPriceObjKeynames(json_data) {
  var obj = {};
  var key_extract_re = /\d+\.\s+(.*)/

  for (var key in json_data) {
    var cleaned_key = (key.match(key_extract_re) || [ "", "ERROR" ])[1];
    obj[cleaned_key] = json_data[key];
  }
  return obj;
}

function extractLatestDataPointAsObj(json_data) {
  var data_point = extractNewestDataPoint(json_data);
  var obj = cleanAVPriceObjKeynames(data_point);
  return obj;
}

function getStockMetric(ticker) {
  var daily_data = extractLatestDataPointAsObj(getAlphaVantageDaily(ticker));
  //var intra_data = extractLatestDataPointAsObj(getAlphaVantageIntra(ticker));

  var cell_arr = []; // Array of cells to return which will represent cells of values in the sheet.
  cell_arr.push(parseFloat(daily_data["close"]));
  cell_arr.push(parseFloat(daily_data["close"]));

  return cell_arr;
}

function getStockMetrics(tickers_arr) {
  rtn_data = [];

  tickers_arr.forEach((ticker) => {
    console.log("Getting metrics for... "+ticker);
    data = getStockMetric(ticker[0])
    rtn_data.push(data);
  });

  return rtn_data;
}

function test_getStockMetrics() {
  var data = getStockMetrics("VWO");
  console.log(data);
  return data;
}

function TEST(input) {
  return (JSON.stringify(input));
}
