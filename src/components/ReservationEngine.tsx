import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Users,
  Check,
  ArrowRight,
  ArrowLeft,
  Download,
  Printer,
  MessageCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useCafe } from '../context/CafeContext';
import { CafeTable, ReservationRecord } from '../types/cafe';
import { InteractiveFloorPlan } from './InteractiveFloorPlan';
import { QrCodeSvg } from './EditorialVisual';

const STEPS = [
  { num: '01', label: 'Date' },
  { num: '02', label: 'Time' },
  { num: '03', label: 'Guests' },
  { num: '04', label: 'Table' },
  { num: '05', label: 'Details' },
  { num: '06', label: 'Requests' },
  { num: '07', label: 'Confirm' },
];

const SERVICE_PERIODS = [
  {
    title: 'Morning Sanctuary & Highland Pour-Over',
    subtitle: 'Post-climb hopper brunch & single-estate filter coffee (08:00 AM – 11:30 AM)',
    slots: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'],
  },
  {
    title: 'Midday Tropical Solace',
    subtitle: 'Shaded stone courtyard lunch & cold-pressed elixirs (12:00 PM – 03:30 PM)',
    slots: ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'],
  },
  {
    title: 'Golden Hour & Live Hearth',
    subtitle: 'Sunset verandah aperitifs & cinnamon-wood grill (04:00 PM – 08:30 PM)',
    slots: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'],
  },
  {
    title: 'Moonlit Garden & Night Lounge',
    subtitle: 'Candlelit acoustic sessions & late digestifs (09:00 PM – 10:00 PM)',
    slots: ['21:00', '21:30', '22:00'],
  },
];

const DIAL_CODES = [
  { code: '+94', label: 'LK +94 (Sri Lanka)' },
  { code: '+44', label: 'UK +44 (United Kingdom)' },
  { code: '+1', label: 'US/CA +1 (North America)' },
  { code: '+49', label: 'DE +49 (Germany)' },
  { code: '+33', label: 'FR +33 (France)' },
  { code: '+61', label: 'AU +61 (Australia)' },
  { code: '+41', label: 'CH +41 (Switzerland)' },
  { code: '+31', label: 'NL +31 (Netherlands)' },
  { code: '+65', label: 'SG +65 (Singapore)' },
  { code: '+971', label: 'AE +971 (UAE)' },
  { code: '+91', label: 'IN +91 (India)' },
];

const COUNTRIES = [
  'Sri Lanka',
  'United Kingdom',
  'United States',
  'Germany',
  'France',
  'Australia',
  'Switzerland',
  'Netherlands',
  'Canada',
  'Singapore',
  'United Arab Emirates',
  'India',
  'Italy',
  'Spain',
  'Japan',
  'Other',
];

function format12Hour(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${suffix}`;
}

function getNextDateIso(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function getUpcomingDayOfWeekIso(targetDay: number): string {
  const d = new Date();
  const current = d.getDay();
  const diff = (targetDay + 7 - current) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export const ReservationEngine: React.FC<{
  initialVoucherCode?: string | null;
}> = ({ initialVoucherCode }) => {
  const {
    settings,
    zones,
    tables,
    blockedDates,
    availability,
    sessionId,
    holdTableSlot,
    confirmReservation,
  } = useCafe();

  const [step, setStep] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<string>(() => getNextDateIso(1));
  const [selectedTime, setSelectedTime] = useState<string>('18:30');
  const [selectedPeriodTitle, setSelectedPeriodTitle] = useState<string>('Golden Hour & Live Hearth');
  const [partySize, setPartySize] = useState<number>(2);
  const [selectedTable, setSelectedTable] = useState<CafeTable | null>(null);

  // Hold state
  const [holdExpiresAtMs, setHoldExpiresAtMs] = useState<number | null>(null);
  const [holdRemainingSec, setHoldRemainingSec] = useState<number>(0);
  const [isHolding, setIsHolding] = useState<boolean>(false);

  // Guest Dossier state
  const [guestName, setGuestName] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [dialCode, setDialCode] = useState<string>('+94');
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');
  const [country, setCountry] = useState<string>('Sri Lanka');

  // Occasion & Notes state
  const [occasion, setOccasion] = useState<string>('No special occasion');
  const [quickTags, setQuickTags] = useState<string[]>([]);
  const [dietaryNotes, setDietaryNotes] = useState<string>('');
  const [agreedPolicy, setAgreedPolicy] = useState<boolean>(false);

  // Submission & Confirmed Voucher state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedReservation, setConfirmedReservation] = useState<ReservationRecord | null>(null);

  // Load saved voucher if navigating directly to /reserve/voucher/:code
  useEffect(() => {
    if (initialVoucherCode && typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(`onelove_voucher_${initialVoucherCode}`);
      if (saved) {
        try {
          setConfirmedReservation(JSON.parse(saved));
          setStep(7);
        } catch {
          // ignore
        }
      }
    }
  }, [initialVoucherCode]);

  // Live countdown timer for active table hold
  useEffect(() => {
    if (!holdExpiresAtMs) {
      setHoldRemainingSec(0);
      return;
    }
    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((holdExpiresAtMs - Date.now()) / 1000));
      setHoldRemainingSec(diff);
    };
    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [holdExpiresAtMs]);

  const blockedRecordForDate = useMemo(
    () => blockedDates.find((b) => b.date === selectedDate),
    [blockedDates, selectedDate]
  );

  const handleLockTableAndContinue = async () => {
    if (!selectedTable) {
      setErrorMsg('Please select an available table on the floor plan.');
      return;
    }
    setErrorMsg(null);
    setIsHolding(true);
    try {
      const hold = await holdTableSlot(selectedDate, selectedTime, selectedTable.id);
      setHoldExpiresAtMs(hold.expiresAtMs);
      setStep(5);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to hold table. Please try another table.');
    } finally {
      setIsHolding(false);
    }
  };

  const handleProceedFromDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestName.trim().length < 2) {
      setErrorMsg('Please enter the principal guest name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      setErrorMsg('Please enter a valid confirmation email address.');
      return;
    }
    if (whatsappNumber.trim().length < 5) {
      setErrorMsg('Please enter your WhatsApp phone number.');
      return;
    }
    setErrorMsg(null);
    setStep(6);
  };

  const handleFinalConfirm = async () => {
    if (!selectedTable) return;
    if (!agreedPolicy) {
      setErrorMsg('Please confirm that you agree to the 15-minute arrival grace period policy.');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const combinedRequests = [
        quickTags.length > 0 ? `Tags: ${quickTags.join(', ')}` : '',
        dietaryNotes.trim(),
      ]
        .filter(Boolean)
        .join(' · ');

      const record = await confirmReservation({
        date: selectedDate,
        time: selectedTime,
        servicePeriod: selectedPeriodTitle,
        partySize,
        tableId: selectedTable.id,
        tableLabel: selectedTable.label,
        zoneId: selectedTable.zoneId,
        zoneName: selectedTable.zoneName,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        whatsapp: `${dialCode} ${whatsappNumber.trim()}`,
        country,
        occasion,
        dietaryNotes: dietaryNotes.trim(),
        specialRequests: combinedRequests,
      });

      setConfirmedReservation(record);
      setHoldExpiresAtMs(null);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', `/reserve/voucher/${record.referenceCode}`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not complete reservation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadIcs = (res: ReservationRecord) => {
    const [year, month, day] = res.date.split('-').map(Number);
    const [hour, minute] = res.time.split(':').map(Number);
    const startDt = new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30));
    const endDt = new Date(startDt.getTime() + 90 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//OneLove Cafe Sigiriya//Reservation Engine//EN',
      'BEGIN:VEVENT',
      `UID:${res.referenceCode}@onelovecafe.lk`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(startDt)}`,
      `DTEND:${fmt(endDt)}`,
      `SUMMARY:OneLove Café Sigiriya — ${res.tableLabel} (${res.partySize} Guests)`,
      `DESCRIPTION:Reservation Reference: #${res.referenceCode}\\nZone: ${res.zoneName}\\nGuest: ${res.guestName}\\nGrace Period: ${settings.gracePeriodMinutes} Minutes`,
      `LOCATION:${settings.address}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OneLove-Cafe-${res.referenceCode}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleQuickTag = (tag: string) => {
    setQuickTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  // Render Confirmed Official Voucher View
  if (confirmedReservation) {
    return (
      <div className="max-w-3xl mx-auto text-[#171513]">
        <div
          id="printable-voucher"
          className="bg-white border border-[#E7DED3] p-8 sm:p-12 space-y-8 text-[#171513]"
        >
          <div className="text-center space-y-3 border-b border-[#E7DED3] pb-8">
            <div className="w-12 h-12 mx-auto border border-[#58644E] text-[#58644E] flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <div className="text-xs tracking-widest uppercase text-[#C65B2B] font-medium">
              OneLove Café Sigiriya · Official Sanctuary Voucher
            </div>
            <h3 className="text-3xl sm:text-4xl font-editorial font-semibold text-[#171513]">
              Reservation Confirmed
            </h3>
            <p className="text-sm text-[#171513]/75 max-w-md mx-auto">
              Thank you, <span className="font-semibold text-[#171513]">{confirmedReservation.guestName}</span>. Your
              sanctuary table has been allocated in Firestore for{' '}
              <span className="font-semibold text-[#171513]">{confirmedReservation.guestEmail}</span>.
            </p>
          </div>

          {/* Voucher Dossier Grid */}
          <div className="bg-[#F8F4EE] border border-[#E7DED3] p-6 sm:p-8 space-y-6 text-[#171513]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7DED3] pb-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#171513]/60 font-semibold">
                  Voucher Reference
                </div>
                <div className="text-2xl font-mono-tabular font-bold text-[#171513]">
                  #{confirmedReservation.referenceCode}
                </div>
              </div>
              <div className="text-xs font-semibold text-[#58644E]">
                Status: Confirmed · Host Desk Notified
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#171513]/60 font-medium">Date</div>
                <div className="font-mono-tabular font-semibold text-[#171513] mt-0.5">{confirmedReservation.date}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#171513]/60 font-medium">Time Slot</div>
                <div className="font-mono-tabular font-semibold text-[#171513] mt-0.5">
                  {format12Hour(confirmedReservation.time)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#171513]/60 font-medium">Party Size</div>
                <div className="font-mono-tabular font-semibold text-[#171513] mt-0.5">
                  {confirmedReservation.partySize} Guests
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#171513]/60 font-medium">Allocated Table</div>
                <div className="font-semibold text-[#C65B2B] mt-0.5">{confirmedReservation.tableLabel}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#171513]/60 font-medium">Seating Zone</div>
                <div className="font-semibold text-[#171513] mt-0.5">{confirmedReservation.zoneName}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#171513]/60 font-medium">Grace Period</div>
                <div className="font-mono-tabular font-semibold text-[#171513] mt-0.5">
                  {settings.gracePeriodMinutes} Minutes
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#171513]/60 font-medium">Guest Country</div>
                <div className="font-semibold text-[#171513] mt-0.5">{confirmedReservation.country}</div>
              </div>
              <div className="col-span-2 sm:col-span-2">
                <div className="text-[11px] uppercase tracking-wider text-[#171513]/60 font-medium">WhatsApp</div>
                <div className="font-mono-tabular font-semibold text-[#171513] mt-0.5">{confirmedReservation.whatsapp}</div>
              </div>
            </div>
          </div>

          {/* QR Code & Arrival Instructions */}
          <div className="flex flex-col items-center text-center space-y-3 py-2">
            <QrCodeSvg
              value={`ONELOVE:${confirmedReservation.referenceCode}:${confirmedReservation.date}:${confirmedReservation.time}:${confirmedReservation.tableId}`}
              size={156}
            />
            <div className="text-[11px] uppercase tracking-widest text-[#171513]/60 font-mono-tabular">
              Present QR Code Upon Arrival at OneLove Host Desk
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-[#E7DED3]">
            <button
              type="button"
              onClick={() => handleDownloadIcs(confirmedReservation)}
              className="px-6 py-2.5 rounded-full bg-[#171513] text-[#F8F4EE] text-xs font-semibold tracking-wider uppercase inline-flex items-center gap-2 hover:bg-[#C65B2B] transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Add to Calendar (.ICS)
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-6 py-2.5 rounded-full border border-[#171513] text-[#171513] text-xs font-semibold tracking-wider uppercase inline-flex items-center gap-2 hover:bg-[#171513] hover:text-[#F8F4EE] transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print Voucher
            </button>
            <a
              href={`https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                `Ayubowan OneLove Café! My table reservation reference is #${confirmedReservation.referenceCode} for ${confirmedReservation.partySize} guests on ${confirmedReservation.date} at ${confirmedReservation.time}.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-2.5 rounded-full bg-[#58644E] text-white text-xs font-semibold tracking-wider uppercase inline-flex items-center gap-2 hover:bg-[#495440] transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Host Desk
            </a>
            <button
              type="button"
              onClick={() => {
                setConfirmedReservation(null);
                setSelectedTable(null);
                setStep(1);
              }}
              className="px-4 py-2.5 text-xs font-medium text-[#171513]/60 hover:text-[#171513] transition-colors whitespace-nowrap shrink-0"
            >
              Book Another Table
            </button>
          </div>
        </div>
      </div>
    );
  }

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-[#171513]">
      {/* 7-Step Horizontal Stepper */}
      <div className="bg-white border border-[#E7DED3] px-4 py-5 sm:px-8 text-[#171513]">
        <div className="grid grid-cols-7 gap-1 sm:gap-2 items-center">
          {STEPS.map((s, idx) => {
            const stepNum = idx + 1;
            const isCompleted = step > stepNum;
            const isCurrent = step === stepNum;
            return (
              <button
                key={s.num}
                type="button"
                disabled={stepNum > step}
                onClick={() => stepNum < step && setStep(stepNum)}
                className="flex flex-col items-center gap-1.5 group disabled:cursor-default"
              >
                <div
                  className={`w-8 h-8 flex items-center justify-center text-xs font-mono-tabular font-medium transition-colors ${
                    isCompleted
                      ? 'bg-[#58644E] text-white'
                      : isCurrent
                      ? 'bg-[#C65B2B] text-white'
                      : 'bg-[#F8F4EE] text-[#171513]/50 border border-[#E7DED3]'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wider font-medium ${
                    isCurrent ? 'text-[#C65B2B]' : isCompleted ? 'text-[#171513]' : 'text-[#171513]/40'
                  }`}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Hold Banner */}
      {holdRemainingSec > 0 && selectedTable && step >= 5 && (
        <div className="flex items-center justify-center">
          <div className="px-4 py-1.5 bg-[#F8F4EE] border border-[#C65B2B]/40 text-xs font-mono-tabular text-[#C65B2B]">
            Table {selectedTable.number} Held Exclusively · {formatCountdown(holdRemainingSec)}
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-[#FDF3EF] border border-[#C65B2B] p-4 flex items-start gap-3 text-sm text-[#9E3F16]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Step Card */}
      <div className="bg-white border border-[#E7DED3] p-6 sm:p-10 text-[#171513]">
        {/* STEP 1: SELECT DATE */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="flex items-start justify-between gap-4 border-b border-[#E7DED3] pb-5">
              <div>
                <h3 className="text-2xl sm:text-3xl font-editorial font-semibold text-[#171513]">
                  Select Your Date
                </h3>
                <p className="text-sm text-[#171513]/65 mt-1">
                  Choose your preferred date for tropical garden dining beneath Sigiriya Rock
                </p>
              </div>
              <Calendar className="w-6 h-6 text-[#C65B2B] shrink-0" />
            </div>

            {/* Quick Date Selection */}
            <div className="space-y-2.5">
              <label className="block text-xs uppercase tracking-wider text-[#171513]/60 font-medium">
                Quick Date Selection
              </label>
              <div className="flex flex-wrap gap-2.5">
                {[
                  { label: 'Tomorrow', date: getNextDateIso(1) },
                  { label: 'In 2 Days', date: getNextDateIso(2) },
                  { label: 'This Friday', date: getUpcomingDayOfWeekIso(5) },
                  { label: 'This Saturday', date: getUpcomingDayOfWeekIso(6) },
                  { label: 'This Sunday', date: getUpcomingDayOfWeekIso(0) },
                ].map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => setSelectedDate(q.date)}
                    className={`px-4 py-2 text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                      selectedDate === q.date
                        ? 'bg-[#171513] text-[#F8F4EE] border-[#171513]'
                        : 'bg-[#F8F4EE] text-[#171513] border-[#E7DED3] hover:border-[#171513]'
                    }`}
                  >
                    {q.label} ({q.date.slice(5)})
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Calendar Date Input */}
            <div className="space-y-2">
              <label
                htmlFor="reservation-date"
                className="block text-xs uppercase tracking-wider text-[#171513]/70 font-semibold"
              >
                Custom Calendar Date
              </label>
              <input
                id="reservation-date"
                type="date"
                min={getNextDateIso(0)}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full sm:w-72 px-4 py-3 bg-[#F8F4EE] border border-[#E7DED3] text-sm font-mono-tabular text-[#171513] font-medium [color-scheme:light] focus:outline-none focus:border-[#C65B2B]"
              />
            </div>

            {blockedRecordForDate?.isFullDay && (
              <div className="p-4 bg-[#FDF3EF] border border-[#C65B2B] text-xs text-[#9E3F16]">
                Note: {selectedDate} is marked for a private sanctuary event ({blockedRecordForDate.reason}). Please choose another date.
              </div>
            )}

            {/* House Policy Box */}
            <div className="bg-[#F8F4EE] border border-[#E7DED3] p-5 space-y-2 text-xs text-[#171513]/75">
              <div className="font-semibold uppercase tracking-wider text-[#171513]">
                House Policy &amp; Sanctuary Rhythms
              </div>
              <p>· Reserved tables are held with a {settings.gracePeriodMinutes}-minute arrival grace period.</p>
              <p>· Morning pour-over service begins at 7:30 AM; live cinnamon-wood hearth cooking starts at 5:00 PM.</p>
              <p>· Walk-in travelers are always welcome at our Roastery Bar counter.</p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={Boolean(blockedRecordForDate?.isFullDay)}
                onClick={() => setStep(2)}
                className="px-6 py-2.5 rounded-full bg-[#C65B2B] text-white text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2 hover:bg-[#B04E22] transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
              >
                Continue to Service Time <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CHOOSE SERVICE TIME */}
        {step === 2 && (
          <div className="space-y-8">
            <div className="flex items-start justify-between gap-4 border-b border-[#E7DED3] pb-5">
              <div>
                <h3 className="text-2xl sm:text-3xl font-editorial font-semibold text-[#171513]">
                  Choose Service Time
                </h3>
                <p className="text-sm text-[#171513]/65 mt-1 font-mono-tabular">
                  Selected Date: {selectedDate}
                </p>
              </div>
              <Clock className="w-6 h-6 text-[#C65B2B] shrink-0" />
            </div>

            <div className="space-y-7">
              {SERVICE_PERIODS.map((period) => (
                <div key={period.title} className="space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase tracking-wider font-semibold text-[#171513]">
                        {period.title}
                      </div>
                      <div className="text-xs text-[#171513]/60">{period.subtitle}</div>
                    </div>
                    <span className="text-[11px] font-mono-tabular text-[#58644E]">
                      {period.slots.length} slots available
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                    {period.slots.map((slot) => {
                      const isBlocked = blockedRecordForDate?.blockedSlots?.includes(slot);
                      const isSelected = selectedTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={isBlocked}
                          onClick={() => {
                            setSelectedTime(slot);
                            setSelectedPeriodTitle(period.title);
                          }}
                          className={`py-2.5 px-3 text-xs font-mono-tabular font-medium border transition-colors whitespace-nowrap shrink-0 ${
                            isSelected
                              ? 'bg-[#171513] text-[#F8F4EE] border-[#171513]'
                              : isBlocked
                              ? 'bg-[#F8F4EE]/50 text-[#171513]/30 border-[#E7DED3] cursor-not-allowed'
                              : 'bg-[#F8F4EE] text-[#171513] border-[#E7DED3] hover:border-[#C65B2B]'
                          }`}
                        >
                          {format12Hour(slot)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#E7DED3]">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs uppercase tracking-wider font-medium text-[#171513]/70 hover:text-[#171513] inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-2.5 rounded-full bg-[#C65B2B] text-white text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2 hover:bg-[#B04E22] transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
              >
                Continue to Party Size <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PARTY SIZE */}
        {step === 3 && (
          <div className="space-y-8">
            <div className="flex items-start justify-between gap-4 border-b border-[#E7DED3] pb-5">
              <div>
                <h3 className="text-2xl sm:text-3xl font-editorial font-semibold text-[#171513]">
                  Party Size
                </h3>
                <p className="text-sm text-[#171513]/65 mt-1">
                  We will highlight floor plan tables configured for your party
                </p>
              </div>
              <Users className="w-6 h-6 text-[#C65B2B] shrink-0" />
            </div>

            {/* Interactive Counter */}
            <div className="flex items-center justify-center gap-8 py-4">
              <button
                type="button"
                aria-label="Decrease guests"
                onClick={() => {
                  setPartySize((p) => Math.max(1, p - 1));
                  setSelectedTable(null);
                }}
                className="w-12 h-12 border border-[#E7DED3] bg-[#F8F4EE] text-[#171513] text-2xl font-bold flex items-center justify-center hover:bg-[#171513] hover:text-[#F8F4EE] hover:border-[#171513] transition-colors cursor-pointer shadow-xs"
              >
                −
              </button>
              <div className="text-center">
                <div className="text-5xl font-editorial font-semibold font-mono-tabular text-[#171513]">
                  {partySize}
                </div>
                <div className="text-xs uppercase tracking-widest text-[#C65B2B] mt-1 font-medium">
                  Guests
                </div>
              </div>
              <button
                type="button"
                aria-label="Increase guests"
                onClick={() => {
                  setPartySize((p) => Math.min(8, p + 1));
                  setSelectedTable(null);
                }}
                className="w-12 h-12 border border-[#E7DED3] bg-[#F8F4EE] text-[#171513] text-2xl font-bold flex items-center justify-center hover:bg-[#171513] hover:text-[#F8F4EE] hover:border-[#171513] transition-colors cursor-pointer shadow-xs"
              >
                +
              </button>
            </div>

            {/* Preset Party Size Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { count: 2, desc: 'Couple / Duo' },
                { count: 4, desc: 'Small Group' },
                { count: 6, desc: 'Family & Friends' },
                { count: 8, desc: 'Lotus Pavilion' },
              ].map((preset) => (
                <button
                  key={preset.count}
                  type="button"
                  onClick={() => {
                    setPartySize(preset.count);
                    setSelectedTable(null);
                  }}
                  className={`p-4 border text-center transition-colors ${
                    partySize === preset.count
                      ? 'bg-[#FDF3EF] border-[#C65B2B] text-[#C65B2B]'
                      : 'bg-[#F8F4EE] border-[#E7DED3] text-[#171513] hover:border-[#171513]'
                  }`}
                >
                  <div className="text-base font-semibold">{preset.count} Guests</div>
                  <div className="text-[11px] uppercase tracking-wider opacity-70 mt-0.5">
                    {preset.desc}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#E7DED3]">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs uppercase tracking-wider font-medium text-[#171513]/70 hover:text-[#171513] inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-6 py-2.5 rounded-full bg-[#C65B2B] text-white text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2 hover:bg-[#B04E22] transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
              >
                Select Table on Floor Plan <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: INTERACTIVE FLOOR PLAN */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E7DED3] pb-4">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-medium">
                  Interactive Architectural Floor Plan
                </div>
                <h3 className="text-2xl sm:text-3xl font-editorial font-semibold text-[#171513]">
                  Select Your Sanctuary Table
                </h3>
                <p className="text-xs text-[#171513]/65 font-mono-tabular mt-0.5">
                  {partySize} Guests · {format12Hour(selectedTime)} · {selectedDate}
                </p>
              </div>
              {selectedTable && (
                <div className="px-4 py-2 bg-[#F8F4EE] border border-[#C65B2B] text-xs">
                  <div className="font-semibold text-[#171513]">
                    Selected: {selectedTable.label} ({selectedTable.zoneName})
                  </div>
                  <div className="text-[#171513]/65">{selectedTable.notes}</div>
                </div>
              )}
            </div>

            <InteractiveFloorPlan
              tables={tables}
              zones={zones}
              availability={availability}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              partySize={partySize}
              selectedTableId={selectedTable?.id || null}
              sessionId={sessionId}
              onSelectTable={(t) => setSelectedTable(t)}
              floorPlanImageUrl={settings.floorPlanImageUrl}
            />

            <div className="flex items-center justify-between pt-4 border-t border-[#E7DED3]">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-xs uppercase tracking-wider font-medium text-[#171513]/70 hover:text-[#171513] inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                type="button"
                disabled={!selectedTable || isHolding}
                onClick={handleLockTableAndContinue}
                className="px-6 py-2.5 rounded-full bg-[#C65B2B] text-white text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2 hover:bg-[#B04E22] transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
              >
                {isHolding ? 'Locking Table Hold...' : 'Proceed with Table'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: GUEST DOSSIER DETAILS */}
        {step === 5 && (
          <form onSubmit={handleProceedFromDetails} className="space-y-6">
            <div className="border-b border-[#E7DED3] pb-4">
              <h3 className="text-2xl sm:text-3xl font-editorial font-semibold text-[#171513]">
                Guest Dossier
              </h3>
              <p className="text-xs text-[#171513]/65 font-mono-tabular mt-1">
                {selectedTable?.label} ({selectedTable?.zoneName}) · {partySize} Guests · {format12Hour(selectedTime)}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-[#171513]">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#171513]">
                  Principal Guest Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Fernando"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F8F4EE] border border-[#E7DED3] text-sm text-[#171513] placeholder-[#171513]/45 focus:outline-none focus:border-[#C65B2B]"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#171513]">
                  Confirmation Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. guest@traveler.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F8F4EE] border border-[#E7DED3] text-sm text-[#171513] placeholder-[#171513]/45 focus:outline-none focus:border-[#C65B2B]"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#171513]">
                  WhatsApp Number *
                </label>
                <div className="flex gap-2">
                  <select
                    value={dialCode}
                    onChange={(e) => setDialCode(e.target.value)}
                    className="w-40 px-3 py-3 bg-[#F8F4EE] border border-[#E7DED3] text-xs font-mono-tabular text-[#171513] font-medium focus:outline-none focus:border-[#C65B2B]"
                  >
                    {DIAL_CODES.map((d) => (
                      <option key={d.code} value={d.code} className="bg-white text-[#171513]">
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    required
                    placeholder="77 123 4567"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="flex-1 px-4 py-3 bg-[#F8F4EE] border border-[#E7DED3] text-sm font-mono-tabular text-[#171513] placeholder-[#171513]/45 focus:outline-none focus:border-[#C65B2B]"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#171513]">
                  Guest Country / Nationality *
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F8F4EE] border border-[#E7DED3] text-sm text-[#171513] font-medium focus:outline-none focus:border-[#C65B2B]"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c} className="bg-white text-[#171513]">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#E7DED3]">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="text-xs uppercase tracking-wider font-medium text-[#171513]/70 hover:text-[#171513] inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Floor Plan
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-full bg-[#C65B2B] text-white text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2 hover:bg-[#B04E22] transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
              >
                Continue to Preferences <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 6 & 7: REQUESTS & FINAL CONFIRMATION */}
        {(step === 6 || step === 7) && (
          <div className="space-y-7">
            <div className="flex items-start justify-between gap-4 border-b border-[#E7DED3] pb-4">
              <div>
                <h3 className="text-2xl sm:text-3xl font-editorial font-semibold text-[#171513]">
                  Special Occasions &amp; Final Confirmation
                </h3>
                <p className="text-sm text-[#171513]/65 mt-1">
                  Tailor your dining experience at OneLove Café Sigiriya
                </p>
              </div>
              <Sparkles className="w-6 h-6 text-[#C65B2B] shrink-0" />
            </div>

            {/* Quick Tag Selectors */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['Birthday', 'Anniversary', 'Wheelchair Access', 'Baby High Chair'].map((tag) => {
                const active = quickTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleQuickTag(tag)}
                    className={`p-3.5 border text-left text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[#FDF3EF] border-[#C65B2B] text-[#C65B2B]'
                        : 'bg-[#F8F4EE] border-[#E7DED3] text-[#171513] hover:border-[#171513]'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5 text-[#171513]">
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#171513]">
                Celebration or Gathering Occasion
              </label>
              <select
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                className="w-full px-4 py-3 bg-[#F8F4EE] border border-[#E7DED3] text-sm text-[#171513] font-medium focus:outline-none focus:border-[#C65B2B]"
              >
                <option value="No special occasion" className="bg-white text-[#171513]">No special occasion</option>
                <option value="Birthday Celebration" className="bg-white text-[#171513]">Birthday Celebration</option>
                <option value="Honeymoon / Anniversary" className="bg-white text-[#171513]">Honeymoon / Anniversary</option>
                <option value="Post-Sigiriya Climb Brunch" className="bg-white text-[#171513]">Post-Sigiriya Climb Brunch</option>
                <option value="Private Tasting Inquiry" className="bg-white text-[#171513]">Private Tasting Inquiry</option>
              </select>
            </div>

            <div className="space-y-1.5 text-[#171513]">
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#171513]">
                Culinary Preferences &amp; Dietary Notes
              </label>
              <textarea
                rows={3}
                placeholder="Shellfish allergies, vegan preferences, romantic candle placement, coffee roast notes..."
                value={dietaryNotes}
                onChange={(e) => setDietaryNotes(e.target.value)}
                className="w-full px-4 py-3 bg-[#F8F4EE] border border-[#E7DED3] text-sm text-[#171513] placeholder-[#171513]/45 focus:outline-none focus:border-[#C65B2B]"
              />
            </div>

            {/* Dark Sanctuary Dossier Summary Box */}
            <div className="bg-[#171513] text-[#F8F4EE] p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between border-b border-[#F8F4EE]/15 pb-3">
                <span className="text-xs uppercase tracking-widest text-[#C65B2B] font-medium">
                  Sanctuary Dossier Summary
                </span>
                <span className="text-[11px] font-mono-tabular text-[#F8F4EE]/50">
                  LIVE FIRESTORE TRANSACTION
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#F8F4EE]/50">Service Date</div>
                  <div className="font-mono-tabular font-medium mt-0.5">{selectedDate}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#F8F4EE]/50">Sitting Time</div>
                  <div className="font-mono-tabular font-medium mt-0.5">{format12Hour(selectedTime)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#F8F4EE]/50">Party Size</div>
                  <div className="font-mono-tabular font-medium mt-0.5">{partySize} Guests</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#F8F4EE]/50">Allocated Table</div>
                  <div className="font-medium text-[#C65B2B] mt-0.5">{selectedTable?.label}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#F8F4EE]/50">Seating Zone</div>
                  <div className="font-medium mt-0.5">{selectedTable?.zoneName}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#F8F4EE]/50">Principal Guest</div>
                  <div className="font-medium mt-0.5">{guestName}</div>
                </div>
              </div>
            </div>

            {/* Policy Checkbox */}
            <label className="flex items-start gap-3 p-4 bg-[#F8F4EE] border border-[#E7DED3] cursor-pointer text-xs text-[#171513]/80">
              <input
                type="checkbox"
                checked={agreedPolicy}
                onChange={(e) => setAgreedPolicy(e.target.checked)}
                className="mt-0.5 accent-[#C65B2B]"
              />
              <span>
                I understand and agree to the {settings.gracePeriodMinutes}-minute table preservation grace period,
                cancellation courtesies, and tranquil garden dining etiquette of OneLove Café Sigiriya.
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={() => setStep(5)}
                className="text-xs uppercase tracking-wider font-medium text-[#171513]/70 hover:text-[#171513] inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Guest Details
              </button>
              <button
                type="button"
                disabled={submitting || !agreedPolicy}
                onClick={handleFinalConfirm}
                className="px-8 py-3 rounded-full bg-[#C65B2B] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#B04E22] transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
              >
                {submitting ? 'Committing Reservation...' : 'Confirm Sanctuary Reservation'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
