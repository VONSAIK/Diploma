export interface Asset {
  ticker: string
  name: string
  category: Category
}

export type Category =
  | 'Технології'
  | 'Фінанси'
  | 'Охорона здоров\'я'
  | 'Енергетика'
  | 'Споживчі товари'
  | 'ETF'
  | 'Індекси'
  | 'Крипто'

export const ASSETS: Asset[] = [
  // Технології
  { ticker: 'AAPL',  name: 'Apple',             category: 'Технології' },
  { ticker: 'MSFT',  name: 'Microsoft',          category: 'Технології' },
  { ticker: 'GOOGL', name: 'Alphabet (Google)',   category: 'Технології' },
  { ticker: 'NVDA',  name: 'NVIDIA',             category: 'Технології' },
  { ticker: 'META',  name: 'Meta Platforms',      category: 'Технології' },
  { ticker: 'AMZN',  name: 'Amazon',             category: 'Технології' },
  { ticker: 'TSLA',  name: 'Tesla',              category: 'Технології' },
  { ticker: 'AMD',   name: 'AMD',                category: 'Технології' },
  { ticker: 'INTC',  name: 'Intel',              category: 'Технології' },
  { ticker: 'CRM',   name: 'Salesforce',         category: 'Технології' },
  { ticker: 'ORCL',  name: 'Oracle',             category: 'Технології' },
  { ticker: 'ADBE',  name: 'Adobe',              category: 'Технології' },
  { ticker: 'NFLX',  name: 'Netflix',            category: 'Технології' },
  { ticker: 'SHOP',  name: 'Shopify',            category: 'Технології' },
  { ticker: 'UBER',  name: 'Uber',               category: 'Технології' },
  // Фінанси
  { ticker: 'JPM',   name: 'JPMorgan Chase',     category: 'Фінанси' },
  { ticker: 'BAC',   name: 'Bank of America',    category: 'Фінанси' },
  { ticker: 'GS',    name: 'Goldman Sachs',      category: 'Фінанси' },
  { ticker: 'V',     name: 'Visa',               category: 'Фінанси' },
  { ticker: 'MA',    name: 'Mastercard',         category: 'Фінанси' },
  { ticker: 'BRK-B', name: 'Berkshire Hathaway', category: 'Фінанси' },
  { ticker: 'WFC',   name: 'Wells Fargo',        category: 'Фінанси' },
  { ticker: 'MS',    name: 'Morgan Stanley',     category: 'Фінанси' },
  // Охорона здоров'я
  { ticker: 'JNJ',   name: 'Johnson & Johnson',  category: 'Охорона здоров\'я' },
  { ticker: 'PFE',   name: 'Pfizer',             category: 'Охорона здоров\'я' },
  { ticker: 'UNH',   name: 'UnitedHealth',       category: 'Охорона здоров\'я' },
  { ticker: 'ABBV',  name: 'AbbVie',             category: 'Охорона здоров\'я' },
  { ticker: 'MRK',   name: 'Merck',              category: 'Охорона здоров\'я' },
  // Енергетика
  { ticker: 'XOM',   name: 'ExxonMobil',         category: 'Енергетика' },
  { ticker: 'CVX',   name: 'Chevron',            category: 'Енергетика' },
  { ticker: 'NEE',   name: 'NextEra Energy',     category: 'Енергетика' },
  { ticker: 'COP',   name: 'ConocoPhillips',     category: 'Енергетика' },
  // Споживчі товари
  { ticker: 'KO',    name: 'Coca-Cola',          category: 'Споживчі товари' },
  { ticker: 'PEP',   name: 'PepsiCo',            category: 'Споживчі товари' },
  { ticker: 'PG',    name: 'Procter & Gamble',   category: 'Споживчі товари' },
  { ticker: 'WMT',   name: 'Walmart',            category: 'Споживчі товари' },
  { ticker: 'MCD',   name: "McDonald's",         category: 'Споживчі товари' },
  { ticker: 'NKE',   name: 'Nike',               category: 'Споживчі товари' },
  // ETF
  { ticker: 'SPY',   name: 'S&P 500 ETF',        category: 'ETF' },
  { ticker: 'QQQ',   name: 'Nasdaq 100 ETF',     category: 'ETF' },
  { ticker: 'VTI',   name: 'Total Market ETF',   category: 'ETF' },
  { ticker: 'GLD',   name: 'Gold ETF',           category: 'ETF' },
  { ticker: 'TLT',   name: 'Treasury Bonds ETF', category: 'ETF' },
  { ticker: 'VNQ',   name: 'Real Estate ETF',    category: 'ETF' },
  { ticker: 'EEM',   name: 'Emerging Markets ETF', category: 'ETF' },
  // Індекси
  { ticker: '^GSPC', name: 'S&P 500',            category: 'Індекси' },
  { ticker: '^IXIC', name: 'Nasdaq Composite',   category: 'Індекси' },
  { ticker: '^DJI',  name: 'Dow Jones',          category: 'Індекси' },
  // Крипто
  { ticker: 'BTC-USD', name: 'Bitcoin',          category: 'Крипто' },
  { ticker: 'ETH-USD', name: 'Ethereum',         category: 'Крипто' },
  { ticker: 'BNB-USD', name: 'BNB',              category: 'Крипто' },
  { ticker: 'SOL-USD', name: 'Solana',           category: 'Крипто' },
  { ticker: 'XRP-USD', name: 'XRP',              category: 'Крипто' },
]

export const CATEGORIES = [...new Set(ASSETS.map(a => a.category))] as Category[]
