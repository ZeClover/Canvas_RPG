import { useState } from "react";
import { formatCalendarDate, type CalendarConfig, type CalendarMonth } from "../../domain/calendarFields";
import { useEscapeToClose } from "../../hooks/useEscapeToClose";
import { Icons } from "../Icons";

interface CalendarPanelProps {
  calendar: CalendarConfig;
  onClose: () => void;
  onAdvance: (days: number, note: string) => void;
  onUpdateConfig: (partial: Partial<CalendarConfig>) => void;
}

export function CalendarPanel({ calendar, onClose, onAdvance, onUpdateConfig }: CalendarPanelProps) {
  useEscapeToClose(onClose);
  const [advanceDays, setAdvanceDays] = useState(1);
  const [advanceNote, setAdvanceNote] = useState("");
  const [newMonthName, setNewMonthName] = useState("");
  const [newMonthDays, setNewMonthDays] = useState(30);

  function patchMonth(index: number, partial: Partial<CalendarMonth>) {
    onUpdateConfig({ months: calendar.months.map((m, i) => (i === index ? { ...m, ...partial } : m)) });
  }

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Calendário da campanha">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">CALENDAR ENGINE</span><h2>Calendário</h2></div>
          <button className="icon-button" title="Fechar" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <div className="calendar-current-date">
          <span className="calendar-current-label">{formatCalendarDate(calendar)}</span>
          <span className="calendar-current-day">dia absoluto {calendar.currentDay}</span>
        </div>

        <div className="inline-form">
          <input type="number" value={advanceDays} onChange={(e) => setAdvanceDays(Number(e.target.value) || 0)} style={{ maxWidth: 90 }} />
          <input value={advanceNote} onChange={(e) => setAdvanceNote(e.target.value)} placeholder="Ex.: viagem até a capital, dias de descanso…" />
          <button type="button" disabled={!advanceDays} onClick={() => { onAdvance(advanceDays, advanceNote.trim()); setAdvanceNote(""); }}>
            <Icons.forward /> Avançar dias
          </button>
        </div>

        <span className="eyebrow">CONFIGURAÇÃO</span>
        <label className="compact-field" style={{ marginBottom: 10 }}>
          Nome da era<input value={calendar.epochLabel} placeholder="Ex.: d.C., Era de Ferro, Ciclo Solar…" onChange={(e) => onUpdateConfig({ epochLabel: e.target.value })} />
        </label>

        <span className="eyebrow">MESES ({calendar.months.length})</span>
        <ul className="mini-list calendar-month-list">
          {calendar.months.map((month, index) => (
            <li key={index}>
              <input className="calendar-month-name" value={month.name} onChange={(e) => patchMonth(index, { name: e.target.value })} />
              <input className="calendar-month-days" type="number" value={month.days} onChange={(e) => patchMonth(index, { days: Math.max(1, Number(e.target.value) || 1) })} />
              <span className="mini-list-text" style={{ flex: "0 0 auto" }}>dias</span>
              <button type="button" className="icon-button" title="Remover mês" aria-label="Remover mês" onClick={() => onUpdateConfig({ months: calendar.months.filter((_, i) => i !== index) })}><Icons.close /></button>
            </li>
          ))}
        </ul>
        <div className="inline-form">
          <input value={newMonthName} onChange={(e) => setNewMonthName(e.target.value)} placeholder="Nome do mês" />
          <input type="number" value={newMonthDays} onChange={(e) => setNewMonthDays(Math.max(1, Number(e.target.value) || 1))} style={{ maxWidth: 90 }} />
          <button type="button" disabled={!newMonthName.trim()} onClick={() => {
            onUpdateConfig({ months: [...calendar.months, { name: newMonthName.trim(), days: newMonthDays }] });
            setNewMonthName("");
          }}><Icons.plus /> Adicionar mês</button>
        </div>

        <span className="eyebrow">HISTÓRICO ({calendar.log.length})</span>
        <ul className="mini-list">
          {[...calendar.log].reverse().slice(0, 40).map((entry) => (
            <li key={entry.id}>
              <span className="mini-list-text">{entry.daysAdvanced >= 0 ? `+${entry.daysAdvanced}` : entry.daysAdvanced} dia(s){entry.note ? ` — ${entry.note}` : ""}</span>
            </li>
          ))}
          {!calendar.log.length && <li className="mini-list-empty">Nenhum avanço de tempo registrado ainda.</li>}
        </ul>
      </section>
    </div>
  );
}
