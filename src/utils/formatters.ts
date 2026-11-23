import type { CurrencyCode } from '../types.ts';

export function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  options?: { signed?: boolean; compact?: boolean }
): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const absVal = Math.abs(value);
  const sign = options?.signed ? (value > 0 ? '+' : value < 0 ? '-' : '') : value < 0 ? '-' : '';

  if (currency === 'IDR') {
    if (options?.compact && absVal >= 1_000_000) {
      const jt = absVal / 1_000_000;
      return `${sign}Rp ${jt.toLocaleString('id-ID', {
        minimumFractionDigits: jt % 1 === 0 ? 0 : 1,
        maximumFractionDigits: 1,
      })} jt`;
    }
    const formatted = Math.round(absVal).toLocaleString('id-ID');
    return `${sign}Rp ${formatted}`;
  }

  if (currency === 'USC') {
    if (options?.compact && absVal >= 1_000) {
      const rb = absVal / 1_000;
      return `${sign}${rb.toLocaleString('id-ID', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}K USC`;
    }
    const formatted = absVal.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${sign}${formatted} USC`;
  }

  // USD
  if (options?.compact && absVal >= 1_000) {
    const k = absVal / 1_000;
    return `${sign}$${k.toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}K`;
  }
  const formatted = absVal.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${formatted}`;
}

export function formatPrice(price: number | null | undefined, pair: string): string {
  if (price === null || price === undefined || Number.isNaN(price)) return '—';
  const upper = pair.toUpperCase();
  let decimals = 5;
  if (upper.includes('JPY') || upper.includes('XAU') || upper.includes('XAG')) {
    decimals = 2;
  } else if (upper.includes('US30') || upper.includes('NAS') || upper.includes('BTC')) {
    decimals = 2;
  }
  return price.toFixed(decimals);
}

export function computePlannedRR(
  direction: 'BUY' | 'SELL',
  entry: number,
  sl: number,
  tp: number
): number | null {
  if (!Number.isFinite(entry) || !Number.isFinite(sl) || !Number.isFinite(tp)) {
    return null;
  }
  const risk = direction === 'BUY' ? entry - sl : sl - entry;
  const reward = direction === 'BUY' ? tp - entry : entry - tp;
  if (risk <= 0 || reward <= 0) return null;
  return reward / risk;
}

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const SHORT_MONTHS_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export function formatMonthYearId(year: number, monthIndex0: number): string {
  return `${MONTH_NAMES_ID[monthIndex0] || ''} ${year}`;
}

export function formatShortDateId(dateStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  return `${day} ${SHORT_MONTHS_ID[monthIdx] || parts[1]} ${year}`;
}

export function formatMonthKeyId(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const idx = Number(month) - 1;
  return `${SHORT_MONTHS_ID[idx] || month} ${year}`;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthPrefix(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak dapat diproses.'));
      img.onload = () => {
        const maxWidth = 1400;
        const maxHeight = 1400;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal memproses kanvas gambar.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        resolve(compressed);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escapeCell = (cell: string | number) => {
    const str = String(cell ?? '');
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvLines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
