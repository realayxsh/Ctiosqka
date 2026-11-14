const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_MONTHS = 24;
const MAX_YEARS = 5;

function parsePremiumDuration(input) {
    const value = String(input || '').toLowerCase();
    if (value === 'year') return parsePremiumDuration('1y');
    if (['lifetime', 'forever', 'perm'].includes(value)) {
        return { key: 'lifetime', milliseconds: null, label: 'Lifetime' };
    }

    const monthly = value.match(/^(\d+)m$/);
    if (monthly) {
        const count = Number(monthly[1]);
        if (count < 1 || count > MAX_MONTHS) return null;
        const days = count * 30;
        return { key: `${days}d`, milliseconds: days * DAY_MS, label: `${count} ${count === 1 ? 'Month' : 'Months'}` };
    }

    const yearly = value.match(/^(\d+)(?:y|year|years)$/);
    if (yearly) {
        const count = Number(yearly[1]);
        if (count < 1 || count > MAX_YEARS) return null;
        const days = count * 365;
        return { key: `${days}d`, milliseconds: days * DAY_MS, label: `${count} ${count === 1 ? 'Year' : 'Years'}` };
    }

    const daily = value.match(/^(\d+)d$/);
    if (!daily) return null;
    const days = Number(daily[1]);
    if (days < 1 || days > MAX_YEARS * 365) return null;
    const label = days === 365 ? '1 Year'
        : days % 365 === 0 ? `${days / 365} Years`
        : days % 30 === 0 ? `${days / 30} ${days / 30 === 1 ? 'Month' : 'Months'}`
        : `${days} Days`;
    return { key: `${days}d`, milliseconds: days * DAY_MS, label };
}

function parseGenerationArgs(args = []) {
    if (args.length !== 2) return { error: 'Provide both the number of codes and the duration.' };
    const [amountText, durationText] = args;
    if (!/^\d+$/.test(amountText)) return { error: 'The first argument must be the number of codes to generate.' };
    const amount = Number(amountText);
    if (amount < 1 || amount > 10) return { error: 'Amount must be between 1 and 10.' };
    const duration = parsePremiumDuration(durationText);
    if (!duration) return { error: 'Choose a duration from 1m–24m, 1y–5y, or lifetime.' };
    return { amount, duration };
}

module.exports = { parsePremiumDuration, parseGenerationArgs, MAX_MONTHS, MAX_YEARS };
