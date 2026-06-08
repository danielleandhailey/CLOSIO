export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Try CNBC quote API first (real-time)
    const cnbcRes = await fetch(
      'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=US10Y&requestMethod=itv&no498s=1&partnerId=2&fund=1&exthrs=1&output=json&events=1'
    );
    const cnbcData = await cnbcRes.json();
    const cnbcRate = cnbcData?.FormattedQuoteResult?.FormattedQuote?.[0]?.last;
    if (cnbcRate) {
      // Return full precision (4 digits)
      const rate = parseFloat(cnbcRate).toFixed(4);
      return res.status(200).json({ rate, success: true, source: 'cnbc' });
    }

    // Fallback: Twelve Data API
    const apiKey = '36b46313317e454b8f57f99323653c2f';
    const response = await fetch(
      `https://api.twelvedata.com/price?symbol=TNX&apikey=${apiKey}`
    );
    const data = await response.json();

    if (data.price) {
      const rate = parseFloat(data.price).toFixed(4);
      return res.status(200).json({ rate, success: true, source: 'twelvedata' });
    }

    // Fallback: FRED (prior day close)
    const fredKey = '0e8dd4ee7d6651eaff6e8a9817d768fb';
    const fredRes = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`
    );
    const fredData = await fredRes.json();
    if (fredData.observations && fredData.observations.length > 0) {
      const rate = parseFloat(fredData.observations[0].value).toFixed(4);
      return res.status(200).json({ rate, success: true, source: 'fred' });
    }

    return res.status(200).json({ rate: '4.5000', success: false });
  } catch (e) {
    return res.status(500).json({ error: e.message, rate: '4.5000' });
  }
}
