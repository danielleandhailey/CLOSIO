// Document Parser - Extracts data from dropped docs
// Supports: Credit Report, Closing Disclosure, MISMO 3.4, Appraisal, 1003

export const DOC_TYPES = {
  CREDIT_REPORT: 'credit_report',
  CLOSING_DISCLOSURE: 'closing_disclosure',
  MISMO: 'mismo',
  APPRAISAL: 'appraisal',
  APPLICATION_1003: '1003',
  PURCHASE_AGREEMENT: 'purchase_agreement',
};

// Detect document type from content
export const detectDocType = (text, filename) => {
  const lower = text.toLowerCase();
  const fname = (filename || '').toLowerCase();

  if (fname.includes('mismo') || lower.includes('<loan_application') || lower.includes('<?xml')) {
    return DOC_TYPES.MISMO;
  }
  if (lower.includes('closing disclosure') || fname.includes('cd') || lower.includes('projected payments')) {
    return DOC_TYPES.CLOSING_DISCLOSURE;
  }
  if (lower.includes('credit report') || lower.includes('equifax') || lower.includes('experian') || lower.includes('transunion') || lower.includes('fico')) {
    return DOC_TYPES.CREDIT_REPORT;
  }
  if (lower.includes('appraisal') || lower.includes('market value') || lower.includes('subject property')) {
    return DOC_TYPES.APPRAISAL;
  }
  if (lower.includes('uniform residential') || lower.includes('1003') || fname.includes('1003')) {
    return DOC_TYPES.APPLICATION_1003;
  }
  if (lower.includes('purchase agreement') || lower.includes('earnest money') || lower.includes('purchase contract')) {
    return DOC_TYPES.PURCHASE_AGREEMENT;
  }
  return null;
};

// Parse Credit Report
export const parseCreditReport = (text) => {
  const data = {};

  // Credit scores - look for 3-digit numbers near bureau names
  const scores = [];
  const eqMatch = text.match(/equifax[:\s]*(\d{3})/i);
  const exMatch = text.match(/experian[:\s]*(\d{3})/i);
  const tuMatch = text.match(/transunion[:\s]*(\d{3})/i);

  if (eqMatch) scores.push({ bureau: 'EQ', score: parseInt(eqMatch[1]) });
  if (exMatch) scores.push({ bureau: 'EX', score: parseInt(exMatch[1]) });
  if (tuMatch) scores.push({ bureau: 'TU', score: parseInt(tuMatch[1]) });

  // Fallback - find any 3-digit scores
  if (scores.length === 0) {
    const allScores = text.match(/\b([6-8]\d{2})\b/g);
    if (allScores) {
      allScores.slice(0, 3).forEach((s, i) => {
        scores.push({ bureau: ['EQ', 'EX', 'TU'][i], score: parseInt(s) });
      });
    }
  }

  if (scores.length > 0) {
    data.credit_scores = scores;
    const sorted = scores.map(s => s.score).sort((a, b) => a - b);
    data.credit_score_mid = sorted[Math.floor(sorted.length / 2)];
  }

  // Credit auth date
  const dateMatch = text.match(/(?:date|pulled|auth)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (dateMatch) data.credit_auth_date = dateMatch[1];

  return data;
};

// Parse Closing Disclosure
export const parseClosingDisclosure = (text) => {
  const data = {};

  // Loan amount
  const loanMatch = text.match(/loan\s*amount[:\s]*\$?([\d,]+)/i);
  if (loanMatch) data.loan_amount = parseFloat(loanMatch[1].replace(/,/g, ''));

  // Interest rate
  const rateMatch = text.match(/interest\s*rate[:\s]*([\d.]+)\s*%?/i);
  if (rateMatch) data.rate = parseFloat(rateMatch[1]);

  // Monthly P&I
  const piMatch = text.match(/(?:principal\s*[&+]\s*interest|p\s*[&+]\s*i)[:\s]*\$?([\d,]+)/i);
  if (piMatch) data.monthly_pi = parseFloat(piMatch[1].replace(/,/g, ''));

  // Cash to close
  const cashMatch = text.match(/cash\s*to\s*close[:\s]*\$?([\d,]+)/i);
  if (cashMatch) data.cash_to_close = parseFloat(cashMatch[1].replace(/,/g, ''));

  // Closing/Funded date
  const closeMatch = text.match(/closing\s*date[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (closeMatch) data.funded_date = closeMatch[1];

  // Property address
  const propMatch = text.match(/property[:\s]*(?:address)?[:\s]*([^\n,]+,[^\n,]+,[^\n]+)/i);
  if (propMatch) data.property_address_full = propMatch[1].trim();

  // Seller credits
  const sellerMatch = text.match(/seller\s*cred[it]*[s]?[:\s]*\$?([\d,]+)/i);
  if (sellerMatch) data.seller_cc = parseFloat(sellerMatch[1].replace(/,/g, ''));

  // Broker comp
  const compMatch = text.match(/(?:broker|originator)\s*comp[ensation]*[:\s]*\$?([\d,]+)/i);
  if (compMatch) data.broker_comp = parseFloat(compMatch[1].replace(/,/g, ''));

  return data;
};

// Parse MISMO 3.4 XML
export const parseMISMO = (xmlText) => {
  const data = {};

  const getVal = (tag) => {
    const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i');
    const match = xmlText.match(regex);
    return match ? match[1].trim() : null;
  };

  // Borrower
  data.borrower_first = getVal('FirstName');
  data.borrower_last = getVal('LastName');
  if (data.borrower_first && data.borrower_last) {
    data.name = `${data.borrower_last}, ${data.borrower_first}`;
  }
  data.email = getVal('ContactPointEmailValue') || getVal('Email');
  data.phone = getVal('ContactPointTelephoneValue') || getVal('TelephoneNumber');

  // Property
  data.property_address = getVal('AddressLineText');
  data.property_city = getVal('CityName');
  data.property_state = getVal('StateCode');
  data.property_zip = getVal('PostalCode');
  data.property_type = getVal('PropertyEstateType') || getVal('PropertyType');
  data.occupancy = getVal('PropertyUsageType');

  // Loan
  const loanAmt = getVal('NoteAmount') || getVal('LoanAmount');
  if (loanAmt) data.loan_amount = parseFloat(loanAmt);

  const price = getVal('PropertyEstimatedValueAmount') || getVal('SalesContractAmount');
  if (price) data.purchase_price = parseFloat(price);

  const rate = getVal('NoteRatePercent');
  if (rate) data.rate = parseFloat(rate);

  data.loan_type = getVal('MortgageType') || getVal('LoanType');
  data.loan_purpose = getVal('LoanPurposeType');

  return data;
};

// Parse Appraisal
export const parseAppraisal = (text) => {
  const data = {};

  const valueMatch = text.match(/(?:appraised|market|opinion\s*of)\s*value[:\s]*\$?([\d,]+)/i);
  if (valueMatch) data.appraisal_value = parseFloat(valueMatch[1].replace(/,/g, ''));

  if (/desktop/i.test(text)) data.appraisal_type = 'Desktop';
  else if (/drive.?by/i.test(text)) data.appraisal_type = 'Drive-By';
  else if (/full|interior/i.test(text)) data.appraisal_type = 'Full';
  else if (/waiver|piv|ace/i.test(text)) data.appraisal_type = 'Waiver';

  if (/subject\s*to/i.test(text)) {
    data.appraisal_subject_to = true;
  }

  const dateMatch = text.match(/effective\s*date[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (dateMatch) data.appraisal_date = dateMatch[1];

  return data;
};

// Master parser
export const parseDocument = (content, filename) => {
  const docType = detectDocType(content, filename);

  let extracted = {};
  switch (docType) {
    case DOC_TYPES.CREDIT_REPORT:
      extracted = parseCreditReport(content);
      break;
    case DOC_TYPES.CLOSING_DISCLOSURE:
      extracted = parseClosingDisclosure(content);
      break;
    case DOC_TYPES.MISMO:
      extracted = parseMISMO(content);
      break;
    case DOC_TYPES.APPRAISAL:
      extracted = parseAppraisal(content);
      break;
    default:
      extracted = {};
  }

  return { docType, extracted, filename };
};

export default { parseDocument, detectDocType, DOC_TYPES };
