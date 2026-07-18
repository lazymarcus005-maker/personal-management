export type ThaiBank = {
  symbol: string;
  name: string;
  nameEN: string;
  logo: string;
  keywords: string[];
};

export const thaiBanks: ThaiBank[] = [
  {
    symbol: "BAAC",
    name: "ธ.ก.ส.",
    nameEN: "Bank for Agriculture and Agricultural Cooperatives",
    logo: "/banks/BAAC.png",
    keywords: ["baac", "ธกส", "เพื่อการเกษตร"],
  },
  {
    symbol: "BAY",
    name: "กรุงศรีอยุธยา",
    nameEN: "Krungsri Bank",
    logo: "/banks/BAY.png",
    keywords: ["bay", "krungsri", "ayudhya", "กรุงศรี"],
  },
  {
    symbol: "BBL",
    name: "กรุงเทพ",
    nameEN: "Bangkok Bank",
    logo: "/banks/BBL.png",
    keywords: ["bbl", "bangkok", "กรุงเทพ"],
  },
  {
    symbol: "CIMB",
    name: "ซีไอเอ็มบี",
    nameEN: "CIMB Thai Bank",
    logo: "/banks/CIMB.png",
    keywords: ["cimb", "ซีไอเอ็มบี"],
  },
  {
    symbol: "CITI",
    name: "ซิตี้แบงก์",
    nameEN: "Citibank",
    logo: "/banks/CITI.png",
    keywords: ["citi", "ซิตี้"],
  },
  {
    symbol: "GHB",
    name: "ธ.อ.ส.",
    nameEN: "GH Bank",
    logo: "/banks/GHB.png",
    keywords: ["ghb", "ธอส", "อาคารสงเคราะห์"],
  },
  {
    symbol: "GSB",
    name: "ออมสิน",
    nameEN: "Government Savings Bank",
    logo: "/banks/GSB.png",
    keywords: ["gsb", "ออมสิน"],
  },
  {
    symbol: "HSBC",
    name: "เอชเอสบีซี",
    nameEN: "HSBC Bank",
    logo: "/banks/HSBC.png",
    keywords: ["hsbc", "เอชเอสบีซี"],
  },
  {
    symbol: "IBANK",
    name: "อิสลามแห่งประเทศไทย",
    nameEN: "Islamic Bank of Thailand",
    logo: "/banks/IBANK.png",
    keywords: ["ibank", "islamic", "อิสลาม"],
  },
  {
    symbol: "ICBC",
    name: "ไอซีบีซี",
    nameEN: "ICBC Thai Commercial Bank",
    logo: "/banks/ICBC.png",
    keywords: ["icbc", "ไอซีบีซี"],
  },
  {
    symbol: "KBANK",
    name: "กสิกรไทย",
    nameEN: "Kasikorn Bank",
    logo: "/banks/KBANK.png",
    keywords: ["kbank", "kasikorn", "กสิกร"],
  },
  {
    symbol: "KKP",
    name: "เกียรตินาคิน",
    nameEN: "Kiatnakin Phatra Bank",
    logo: "/banks/KKP.png",
    keywords: ["kkp", "kiatnakin", "เกียรตินาคิน"],
  },
  {
    symbol: "KTB",
    name: "กรุงไทย",
    nameEN: "Krungthai Bank",
    logo: "/banks/KTB.png",
    keywords: ["ktb", "krungthai", "krung thai", "กรุงไทย"],
  },
  {
    symbol: "LHB",
    name: "แลนด์ แอนด์ เฮ้าส์",
    nameEN: "LH Bank",
    logo: "/banks/LHB.png",
    keywords: ["lhb", "lh bank", "land and houses", "แลนด์"],
  },
  {
    symbol: "PromptPay",
    name: "พร้อมเพย์",
    nameEN: "PromptPay",
    logo: "/banks/PromptPay.png",
    keywords: ["promptpay", "พร้อมเพย์"],
  },
  {
    symbol: "SCB",
    name: "ไทยพาณิชย์",
    nameEN: "Siam Commercial Bank",
    logo: "/banks/SCB.png",
    keywords: ["scb", "siam commercial", "ไทยพาณิชย์"],
  },
  {
    symbol: "TCRB",
    name: "ไทยเครดิต",
    nameEN: "Thai Credit Bank",
    logo: "/banks/TCRB.png",
    keywords: ["tcrb", "thai credit", "ไทยเครดิต"],
  },
  {
    symbol: "TISCO",
    name: "ทิสโก้",
    nameEN: "TISCO Bank",
    logo: "/banks/TISCO.png",
    keywords: ["tisco", "ทิสโก้"],
  },
  {
    symbol: "TTB",
    name: "ทีทีบี",
    nameEN: "TMBThanachart Bank",
    logo: "/banks/TTB.png",
    keywords: ["ttb", "tmb", "thanachart", "ทหารไทย", "ธนชาต", "ทีทีบี"],
  },
  {
    symbol: "TrueMoney",
    name: "ทรูมันนี่",
    nameEN: "TrueMoney",
    logo: "/banks/TrueMoney.png",
    keywords: ["truemoney", "true money", "ทรูมันนี่"],
  },
  {
    symbol: "UOB",
    name: "ยูโอบี",
    nameEN: "UOB Bank",
    logo: "/banks/UOB.png",
    keywords: ["uob", "ยูโอบี"],
  },
];

export function findBankLogo(bankName: string | null | undefined): ThaiBank | null {
  if (!bankName) return null;
  const lower = bankName.toLowerCase().trim();
  return (
    thaiBanks.find(
      (bank) =>
        bank.symbol.toLowerCase() === lower ||
        bank.keywords.some((k) => lower.includes(k))
    ) ?? null
  );
}
