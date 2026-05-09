import { format } from 'date-fns';

export interface ReceiptData {
  gymName: string;
  gymLogoUrl?: string | null;
  gymPhone?: string | null;
  gymAddress?: string | null;
  receiptNo: string;
  memberName: string;
  memberCode?: string | null;
  month: string; // 'yyyy-MM' or label
  amount: number;
  paymentDate: string; // 'yyyy-MM-dd'
  paymentMethod: string;
  notes?: string;
}

export function printReceipt(data: ReceiptData) {
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) return;
  const monthLabel = /^\d{4}-\d{2}$/.test(data.month)
    ? format(new Date(data.month + '-01'), 'MMMM yyyy')
    : data.month;
  const dateLabel = format(new Date(data.paymentDate), 'dd MMM yyyy');

  w.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>Receipt — ${data.receiptNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  body{padding:24px;color:#111;background:#fff}
  .receipt{max-width:380px;margin:0 auto;border:2px dashed #333;border-radius:12px;padding:20px}
  .header{text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:14px}
  .logo{width:64px;height:64px;object-fit:contain;margin:0 auto 8px;display:block}
  .gym-name{font-size:22px;font-weight:800;letter-spacing:0.5px}
  .gym-meta{font-size:11px;color:#555;margin-top:4px}
  .title{text-align:center;font-size:13px;letter-spacing:3px;color:#666;margin:8px 0 14px;text-transform:uppercase}
  .row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px dashed #ddd}
  .row:last-of-type{border-bottom:none}
  .label{color:#666}
  .value{font-weight:600;color:#111}
  .amount-box{margin-top:14px;background:#111;color:#fff;padding:14px;border-radius:8px;text-align:center}
  .amount-box .lbl{font-size:11px;letter-spacing:2px;opacity:.7}
  .amount-box .val{font-size:24px;font-weight:800;margin-top:4px}
  .footer{text-align:center;margin-top:14px;font-size:10px;color:#888}
  .stamp{margin-top:18px;text-align:center;color:#16a34a;font-weight:700;border:2px solid #16a34a;padding:6px;border-radius:6px;letter-spacing:3px}
  @media print{body{padding:0}.receipt{border:none}}
</style></head><body>
<div class="receipt">
  <div class="header">
    ${data.gymLogoUrl ? `<img src="${data.gymLogoUrl}" class="logo" alt="logo"/>` : ''}
    <div class="gym-name">${escapeHtml(data.gymName)}</div>
    ${data.gymAddress ? `<div class="gym-meta">${escapeHtml(data.gymAddress)}</div>` : ''}
    ${data.gymPhone ? `<div class="gym-meta">Tel: ${escapeHtml(data.gymPhone)}</div>` : ''}
  </div>
  <div class="title">Payment Receipt</div>
  <div class="row"><span class="label">Receipt #</span><span class="value">${escapeHtml(data.receiptNo)}</span></div>
  <div class="row"><span class="label">Date</span><span class="value">${dateLabel}</span></div>
  <div class="row"><span class="label">Member</span><span class="value">${escapeHtml(data.memberName)}</span></div>
  ${data.memberCode ? `<div class="row"><span class="label">Member ID</span><span class="value">${escapeHtml(data.memberCode)}</span></div>` : ''}
  <div class="row"><span class="label">Month</span><span class="value">${monthLabel}</span></div>
  <div class="row"><span class="label">Method</span><span class="value">${escapeHtml(data.paymentMethod)}</span></div>
  <div class="amount-box">
    <div class="lbl">AMOUNT PAID</div>
    <div class="val">PKR ${Number(data.amount).toLocaleString()}</div>
  </div>
  <div class="stamp">PAID</div>
  ${data.notes ? `<div class="footer" style="margin-top:10px">${escapeHtml(data.notes)}</div>` : ''}
  <div class="footer">Thank you for your payment!</div>
</div>
<script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>
</body></html>`);
  w.document.close();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
