import { useEffect, useState, type JSX } from 'react';
import {
  fetchMoney,
  saveCap,
  saveCredit,
  type Connection,
  type Money as MoneyData,
  type MoneyGroup,
} from './service.js';

/** Money is always US dollars and never converted — Mohamed's ruling. */
export function usd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** To the cent, for the places where the exact figure is the point. */
export function usdExact(amount: number): string {
  return `$${amount.toFixed(6)}`;
}

/**
 * What the old lines are called on screen.
 *
 * Block 12 session 68 measured that the 165 lines written before it say which
 * stage and which model and **nothing about which client or which video**. They
 * are shown under this, and never attributed to a client by the cache, by their
 * timestamp, or by what happened to be open at the time.
 */
export const BEFORE_LABEL = 'before this was recorded';

type Grouping = 'byDay' | 'byMonth' | 'byStage' | 'byClient' | 'byVideo' | 'byPurpose';

const FILTERS: { id: Grouping; label: string }[] = [
  { id: 'byDay', label: 'Day' },
  { id: 'byMonth', label: 'Month' },
  { id: 'byClient', label: 'Client' },
  { id: 'byVideo', label: 'Video' },
  { id: 'byStage', label: 'What it was for' },
  { id: 'byPurpose', label: 'Building or client work' },
];

/** Client and video only cover spending since session 68 started recording it. */
const PARTIAL: Grouping[] = ['byClient', 'byVideo', 'byPurpose'];

export function Money({ connection }: { connection: Connection }): JSX.Element {
  const [data, setData] = useState<MoneyData | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [grouping, setGrouping] = useState<Grouping>('byMonth');
  const [creditDraft, setCreditDraft] = useState('');
  const [capDraft, setCapDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchMoney(connection);
        if (!cancelled) setData(next);
      } catch (error) {
        if (!cancelled) setTrouble((error as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection]);

  if (trouble !== null) {
    return (
      <p className="hint" role="status">
        The spending could not be read: {trouble}
      </p>
    );
  }
  if (data === null) {
    return (
      <p className="hint" role="status">
        Adding up what has been spent…
      </p>
    );
  }

  const groups: MoneyGroup[] = data[grouping];

  return (
    <div className="money">
      <div className="moneybanner">
        <div className="figure">
          <span className="what">Spent since the beginning</span>
          <strong className="total">{usdExact(data.totalUsd)}</strong>
          <span className="since">
            {data.lines} {data.lines === 1 ? 'charge' : 'charges'}
          </span>
          {data.firstAt === null ? null : (
            <span className="since">since {data.firstAt.slice(0, 10)}</span>
          )}
        </div>

        <div className="figure credit">
          <span className="what">Credit left</span>
          {data.credit === null ? (
            <>
              <strong className="total none">not entered</strong>
              <span className="since">Framopia cannot see your account.</span>
            </>
          ) : (
            <>
              <strong className="total">{usd(data.credit.impliedRemainingUsd)}</strong>
              {/*
               * **Three separate things, because they are three.** Session 69
               * rendered his figure, its date, what has been spent and the
               * caveat as one run of text, and Mohamed could not read it.
               *
               * The caveat itself is ruled and survives the rewrite: session 46
               * carried a balance forward by subtracting ledger spend and got
               * $2.91 where a later report said $2.71, a $0.20 gap the
               * repository could not explain.
               */}
              <span className="since">
                You entered {usd(data.credit.enteredUsd)} on{' '}
                {data.credit.enteredAt.slice(0, 10)}
              </span>
              <span className="since">
                {usd(data.credit.spentSinceUsd)} spent since then
              </span>
              <span className="caveat">Subtraction, not a reading of your account</span>
            </>
          )}
        </div>
      </div>

      <div className="creditset">
        <label htmlFor="creditnow">What your billing page says now</label>
        <div className="row">
          <input
            id="creditnow"
            type="text"
            inputMode="decimal"
            value={creditDraft}
            placeholder="0.00"
            onChange={(e) => setCreditDraft(e.target.value)}
          />
          <button
            type="button"
            className="ghost"
            disabled={Number.isNaN(Number(creditDraft)) || creditDraft.trim() === ''}
            onClick={() => {
              void (async () => {
                try {
                  setData(await saveCredit(connection, Number(creditDraft)));
                  setCreditDraft('');
                } catch (error) {
                  setTrouble((error as Error).message);
                }
              })();
            }}
          >
            Save
          </button>
        </div>
      </div>

      <div className="moneyfilters" role="group" aria-label="How to group the spending">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={grouping === f.id ? 'chosen' : ''}
            onClick={() => setGrouping(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {PARTIAL.includes(grouping) ? (
        <p className="hint partial" role="status">
          Framopia only started recording this in September. Everything spent before
          then is listed as “{BEFORE_LABEL}” — {usd(data.unattributedUsd)} of{' '}
          {usd(data.totalUsd)}. It is not left out and it is not guessed at.
        </p>
      ) : null}

      <table className="moneygroups">
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} className={g.key === BEFORE_LABEL ? 'unattributed' : ''}>
              <th scope="row">{g.key}</th>
              <td className="count">{g.lines}</td>
              <td className="amount">{usd(g.usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.perReel.length > 0 ? (
        <>
          <h3>What each video cost</h3>
          <table className="moneyreels">
            <tbody>
              {data.perReel.map((r) => (
                <tr key={r.reel}>
                  <th scope="row" title={r.reel}>
                    {r.reel}
                  </th>
                  <td className="amount">{usd(r.spentUsd)}</td>
                  <td className="rate">
                    {r.usdPerSecond === null ? '—' : `${usd(r.usdPerSecond)}/s`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/*
           * Which stages actually paid, under the row rather than beside it: on
           * a panel this narrow a fourth column pushed the numbers off the edge.
           * Measured on 2026-09-08 — four of the six reels are partial runs, so
           * a reel that only ever had its pictures made must not read as whole.
           */}
          <ul className="reelstages">
            {data.perReel.map((r) => (
              <li key={r.reel}>
                <span className="name">{r.reel}</span>
                <span className="paid">{r.stages.length === 0 ? 'nothing yet' : r.stages.join(', ')}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="moneycap">
        <h3>A monthly cap</h3>
        <p className="faint">
          {data.cap.monthlyUsd === null
            ? `No cap set. ${usd(data.cap.monthSoFarUsd)} spent this month.`
            : `${usd(data.cap.monthSoFarUsd)} of ${usd(data.cap.monthlyUsd)} spent this month.`}{' '}
          A cap only warns. It never stops you making anything.
        </p>
        <label className="capentry">
          <span>Warn me past</span>
          <input
            type="text"
            inputMode="decimal"
            value={capDraft}
            placeholder={data.cap.monthlyUsd === null ? 'no cap' : String(data.cap.monthlyUsd)}
            onChange={(e) => setCapDraft(e.target.value)}
          />
          <button
            type="button"
            className="ghost"
            onClick={() => {
              void (async () => {
                try {
                  const wanted = capDraft.trim() === '' ? null : Number(capDraft);
                  setData(await saveCap(connection, wanted));
                  setCapDraft('');
                } catch (error) {
                  setTrouble((error as Error).message);
                }
              })();
            }}
          >
            Save
          </button>
        </label>
      </div>

      {data.unreadable > 0 ? (
        <p className="hint" role="status">
          {data.unreadable} {data.unreadable === 1 ? 'charge is' : 'charges are'} written
          in a way Framopia does not recognise. They are counted in the total above and
          nothing has been changed.
        </p>
      ) : null}
    </div>
  );
}
