import React, { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Severity = 'LOW' | 'MED' | 'HIGH';
type Level = 'GREEN' | 'YELLOW' | 'RED';
interface Issue { code: string; severity: Severity; message: string; fix: string }
interface Report { level: Level; score: number; issues: Issue[]; meta: any }
type TestResult = { name: string; pass: boolean; details?: string }

export default function App() {
  const isDev = (typeof window !== 'undefined') && new URLSearchParams(window.location.search).get('dev') === '1';
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Hero />
        <UploadAndValidate />
        {isDev && <DevTests />}
      </main>
      <SiteFooter />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-tight text-lg">ClearEdge</span>
          <span className="hidden md:inline text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">MVP v0.3</span>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="text-center" id="how">
      <motion.h1 className="text-3xl md:text-5xl font-extrabold tracking-tight"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        החשבונית נתקעה בגלל <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-500 to-teal-500">מספר הקצה</span>?
      </motion.h1>
      <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
        העלה חשבונית, קבל דו"ח QuickFix צבעוני: מה הבעיה, למה זה נחסם, ומה לתקן.
      </p>
    </section>
  );
}

function UploadAndValidate() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawInvoice, setRawInvoice] = useState<any>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFiles = useCallback(async (file: File) => {
    setLoading(true); setReport(null); setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();
    let data: any = null;
    try {
      if (ext === 'json') {
        const text = await file.text(); data = JSON.parse(text);
      } else if (ext === 'csv') {
        const text = await file.text(); data = csvToInvoice(text);
      } else { throw new Error('ב-MVP: JSON/CSV בלבד'); }
    } catch (e:any) {
      setLoading(false);
      setReport({ level: 'RED', score: 0, issues: [{ code: 'PARSER', severity: 'HIGH', message: e.message, fix: 'נסה JSON/CSV או את הדוגמה' }], meta: {} as any });
      return;
    }
    setRawInvoice(data);
    const r = validateInvoiceLocally(data);
    setReport(r);
    setLoading(false);
  }, []);

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFiles(f); };
  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) onFiles(f); };

  const loadSample = () => {
    const sample = sampleInvoice();
    setRawInvoice(sample);
    const r = validateInvoiceLocally(sample);
    setReport(r);
  };

  return (
    <div className="mt-8">
      <div onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-slate-300 rounded-2xl p-6 md:p-10 bg-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">העלה חשבונית לבדיקה</h3>
            <p className="text-slate-600 text-sm">גרור קובץ JSON/CSV או לחץ לבחור קובץ</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => inputRef.current?.click()} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">בחר קובץ</button>
            <input ref={inputRef} type="file" accept=".json,.csv" className="hidden" onChange={onSelect} />
            <button onClick={loadSample} className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50">נסה דוגמה</button>
          </div>
        </div>
        {fileName && (<p className="mt-3 text-xs text-slate-500">נבחר: {fileName}</p>)}
      </div>

      <AnimatePresence>{loading && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6"><LoadingCard /></motion.div>)}</AnimatePresence>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {rawInvoice && (<InvoicePreview data={rawInvoice} />)}
        {report && (<ReportCard report={report} />)}
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-sky-500 animate-pulse" />
        <p className="text-sm text-slate-600">מריץ בדיקות…</p>
      </div>
    </div>
  );
}

function Badge({ level }: { level: Level }) {
  const bg = level === 'GREEN' ? 'bg-emerald-100 text-emerald-700' : level === 'YELLOW' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
  const label = level === 'GREEN' ? 'תקין' : level === 'YELLOW' ? 'אזהרה' : 'בעייתי';
  return <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${bg}`}>{label}</span>;
}

function ReportCard({ report }: { report: Report }) {
  const bar = report.level === 'GREEN' ? 'bg-emerald-500' : report.level === 'YELLOW' ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">דו\"ח QuickFix</h3>
        <Badge level={report.level} />
      </div>
      <div className="mt-4">
        <div className="h-2 w-full bg-slate-100 rounded">
          <div className={`h-2 rounded ${bar}`} style={{ width: `${report.score}%` }} />
        </div>
        <p className="mt-2 text-sm text-slate-600">ציון תקינות: <b>{report.score}</b>/100</p>
      </div>
      <ul className="mt-4 space-y-3">
        {report.issues.map((i, idx) => (
          <li key={idx} className="border border-slate-200 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{i.message}</span>
              <span className={`text-xs ${i.severity === 'HIGH' ? 'text-rose-600' : i.severity === 'MED' ? 'text-amber-600' : 'text-slate-500'}`}>{i.severity}</span>
            </div>
            <p className="text-xs text-slate-600 mt-1">תיקון מוצע: {i.fix}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InvoicePreview({ data }: { data: any }) {
  const meta = useMemo(() => extractMeta(data), [data]);
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">תצוגה מקדימה של חשבונית</h3>
        <span className="text-xs text-slate-500">מטא־דאטה</span>
      </div>
      <dl className="grid grid-cols-2 gap-3 mt-4 text-sm">
        <RowDtDd dt="ספק (עוסק)" dd={meta.supplierVat || '—'} />
        <RowDtDd dt="לקוח (עוסק)" dd={meta.customerVat || '—'} />
        <RowDtDd dt="תאריך" dd={meta.date || '—'} />
        <RowDtDd dt="מטבע" dd={meta.currency || '—'} />
        <RowDtDd dt={'מע\"מ'} dd={fmt(meta.vat)} />
        <RowDtDd dt={'סה\"כ'} dd={fmt(meta.total)} />
      </dl>
      <div className="mt-4 text-xs text-slate-500 break-words">
        <pre className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}

function RowDtDd({ dt, dd }: { dt: string; dd: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <dt className="text-slate-500 text-xs">{dt}</dt>
      <dd className="font-medium">{dd}</dd>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer id="faq" className="mt-12 py-10 text-center text-xs text-slate-500">
      <p>© {new Date().getFullYear()} ClearEdge — כלי עזר חוקי לבדיקת חשבוניות והכנת תיקים. לא מנפיק ולא עוקף מספרי הקצאה.</p>
    </footer>
  );
}

// ---------- Validator + helpers ----------
function validateInvoiceLocally(inv: any): Report {
  const issues: Issue[] = [];
  if (!inv?.supplierVat) issues.push(req('SUPPLIER_VAT', 'HIGH', 'חסר מספר עוסק של הספק', 'הוסף מספר עוסק (9 ספרות) בשדה supplierVat'));
  if (!inv?.customerVat) issues.push(req('CUSTOMER_VAT', 'MED', 'חסר מספר עוסק של הלקוח', 'הוסף מספר עוסק בשדה customerVat'));
  if (!inv?.date) issues.push(req('DATE', 'MED', 'חסר תאריך חשבונית', 'הוסף תאריך בפורמט YYYY-MM-DD'));
  if (inv?.total == null) issues.push(req('TOTAL', 'HIGH', 'חסר סכום סופי (total)', 'הוסף סכום כולל'));
  if (inv?.vat == null) issues.push(req('VAT', 'MED', 'חסר סכום מע\"מ (vat)', 'הוסף סכום מע\"מ'));
  if (inv?.supplierVat && !/^\d{9}$/.test(String(inv.supplierVat))) issues.push(req('SUPPLIER_VAT_FMT', 'HIGH', 'פורמט עוסק ספק לא תקין', 'ודא 9 ספרות ללא מקפים'));
  if (inv?.customerVat && !/^\d{9}$/.test(String(inv.customerVat))) issues.push(req('CUSTOMER_VAT_FMT', 'MED', 'פורמט עוסק לקוח לא תקין', 'ודא 9 ספרות ללא מקפים'));

  const vatRate = 0.17;
  if (typeof inv.total === 'number' && typeof inv.vat === 'number') {
    const subtotal = Number(inv.total) - Number(inv.vat);
    const expectedVat = Math.round(subtotal * vatRate * 100) / 100;
    const diff = Math.abs(expectedVat - Number(inv.vat));
    if (diff > 1) issues.push(req('VAT_MISMATCH', 'MED', `מע\"מ לא תואם את שיעור ${vatRate * 100}%`, 'בדוק חישובי ביניים/עגול סכומים'));
    if (subtotal <= 0) issues.push(req('SUBTOTAL_NEG', 'HIGH', 'סכום לפני מע\"מ לא תקין (שלילי/אפס)', 'בדוק שורת פריטים וחישוב סיכומים'));
  }

  const supportedCurrencies = ['ILS','USD','EUR'];
  if (inv?.currency && !supportedCurrencies.includes(inv.currency)) issues.push(req('CURRENCY_UNSUPPORTED', 'LOW', 'מטבע לא נתמך ב-MVP', 'השתמש ב-ILS/USD/EUR'));

  if (inv?.invoiceId && String(inv.invoiceId).length < 3) issues.push(req('INVOICE_ID_WEAK', 'LOW', 'מזהה חשבונית חלש/קצר מדי', 'הגדל את אורך המזהה למינימום 6 תווים'));

  let score = 100 - issues.reduce((acc, it) => acc + (it.severity === 'HIGH' ? 25 : it.severity === 'MED' ? 12 : 5), 0);
  score = Math.max(0, Math.min(100, score));
  const level: Level = score >= 85 ? 'GREEN' : score >= 60 ? 'YELLOW' : 'RED';
  return { level, score, issues, meta: extractMeta(inv) };
}

function req(code: string, severity: Severity, message: string, fix: string): Issue { return { code, severity, message, fix }; }
function extractMeta(inv: any) { return { supplierVat: inv?.supplierVat ?? '', customerVat: inv?.customerVat ?? '', total: inv?.total ?? '', vat: inv?.vat ?? '', date: inv?.date ?? '', currency: inv?.currency ?? 'ILS' } }
function fmt(v: any) { return v === '' || v == null ? '—' : String(v) }
function csvToInvoice(text: string) { const [headerLine, ...rows] = text.trim().split(/\r?\n/); const headers = headerLine.split(',').map(s => s.trim()); const row = rows[0]?.split(',').map(s => s.trim()) ?? []; const obj: any = {}; headers.forEach((h, i) => { obj[h]= (/^\d+(\.\d+)?$/.test(row[i]||'')) ? Number(row[i]) : row[i]||''; }); return obj; }

function sampleInvoice() {
  return {
    supplierVat: "512345679",
    customerVat: "598765431",
    invoiceId: "INV-2025-00123",
    date: "2025-09-12",
    currency: "ILS",
    vat: 170,
    total: 1000
  };
}

// ---------- Dev tests (optional, ?dev=1) ----------
function runTests(): TestResult[] {
  const results: TestResult[] = [];
  try { const s = sampleInvoice(); const ok = s && s.total === 1000; results.push({ name: 'sampleInvoice integrity', pass: !!ok, details: ok ? 'OK' : 'wrong values' }); } catch(e:any) { results.push({ name: 'sampleInvoice integrity', pass: false, details: e?.message }); }
  try { const r = validateInvoiceLocally(sampleInvoice()); const ok = r.level === 'GREEN' && r.issues.some(i=>i.code==='VAT_MISMATCH'); results.push({ name: 'validate(sample) VAT_MISMATCH+GREEN', pass: ok, details: `level=${r.level}` }); } catch(e:any){ results.push({ name: 'validate(sample)', pass:false, details:e?.message}); }
  try { const csv='supplierVat,customerVat,total,vat,date,currency,invoiceId\n512345679,598765431,1000,170,2025-09-12,ILS,INV-2025-00123'; const obj=csvToInvoice(csv); const ok = obj.supplierVat==='512345679' && obj.total===1000; results.push({ name:'csvToInvoice parse', pass: ok, details: JSON.stringify(obj)});} catch(e:any){ results.push({ name:'csvToInvoice parse', pass:false, details:e?.message}); }
  return results;
}

function DevTests() {
  const [results] = useState<TestResult[]>(() => runTests());
  const okCount = results.filter(r => r.pass).length;
  const allOk = okCount === results.length;
  return (
    <section className="mt-10">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold">Dev Tests</h3>
        <div className="mt-4"><div className={`inline-block px-2 py-1 rounded-full text-xs ${allOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{okCount}/{results.length} passed</div></div>
        <ul className="mt-4 space-y-2">
          {results.map((r, i) => (<li key={i} className="text-sm flex items-start gap-2"><span className={`mt-1 inline-flex w-2 h-2 rounded-full ${r.pass ? 'bg-emerald-500' : 'bg-rose-500'}`} /><div><div className="font-medium">{r.name}</div><div className="text-xs text-slate-600 break-words">{r.details}</div></div></li>))}
        </ul>
      </div>
    </section>
  );
}
