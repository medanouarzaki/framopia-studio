import { useEffect, useState, type JSX } from 'react';
import {
  fetchMoney,
  removePayment,
  saveCap,
  saveCredit,
  savePayment,
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

/**
 * **What a reel's figure is made of, said rather than labelled.**
 *
 * A plan's own record and the ledger can disagree, and where they do the ledger
 * is the floor — it is written at the point of spend and cannot hold less than
 * was charged. Mohamed prices work off these numbers, so a figure that silently
 * means two things is worse than either.
 *
 * Plain words, not `source: ledger`.
 */
export function madeOf(reel: {
  basis: 'ledger' | 'plan' | 'both';
  planUsd: number;
  ledgerUsd: number;
}): string {
  if (reel.basis === 'ledger') {
    return `from what was actually charged — this video's own record says only ${usd(reel.planUsd)}`;
  }
  if (reel.basis === 'both') {
    return "from this video's own record, and every charge since agrees";
  }
  return "from this video's own record — no charge yet says which video it was for";
}

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
  const [payUsd, setPayUsd] = useState('');
  const [payOn, setPayOn] = useState('');
  const [payAccount, setPayAccount] = useState('');
  /* Named after it goes, so a removal is never silent. */
  const [lastRemoved, setLastRemoved] = useState<string | null>(null);

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
                <span className="paid">
                  {r.stages.length === 0 ? 'nothing yet' : r.stages.join(', ')} · {madeOf(r)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="paidin">
        <h3>Money you have paid in</h3>
        {/*
          * **A payment is not a spend and not a credit reading.** The ledger is
          * what this tool spent through the APIs; a payment is money that went
          * into an account on a day, which nothing here can see. Credit, in the
          * banner above, is what an account has left today — two credit readings
          * do not add up, two payments do, and the screen never mixes them.
          */}
        {data.paidIn.payments.length === 0 ? (
          <p className="faint">Nothing recorded yet. Framopia cannot see your accounts.</p>
        ) : (
          <>
            <table className="paidintable">
              <tbody>
                {data.paidIn.payments.map((p) => (
                  <tr key={p.id}>
                    <th scope="row" title={p.account}>
                      {p.account}
                    </th>
                    <td className="when">{p.on}</td>
                    <td className="amount">{usd(p.usd)}</td>
                    <td className="drop">
                      <button
                        type="button"
                        className="link"
                        onClick={() => {
                          void (async () => {
                            try {
                              const gone = await removePayment(connection, p.id);
                              setData(gone.money);
                              setLastRemoved(
                                `${usd(gone.removed.usd)} to ${gone.removed.account} on ${gone.removed.on}`,
                              );
                            } catch (error) {
                              setTrouble((error as Error).message);
                            }
                          })();
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="paidsum">
              <span className="what">Paid in</span>
              <span className="amount">{usd(data.paidIn.totalInUsd)}</span>
            </div>
            <div className="paidsum">
              <span className="what">Spent</span>
              <span className="amount">{usd(data.totalUsd)}</span>
            </div>
            <div className="paidsum strong">
              <span className="what">Difference</span>
              <span className="amount">{usd(data.paidIn.impliedLeftUsd)}</span>
            </div>
            <p className="caveat">
              Subtraction from what you typed, not a reading of any account.
            </p>
          </>
        )}
        {lastRemoved === null ? null : (
          <p className="faint removed" role="status">
            Removed {lastRemoved}. It was your own note, so nothing else changed.
          </p>
        )}
        <div className="payentry">
          <label htmlFor="payusd">Amount</label>
          <input
            id="payusd"
            type="text"
            inputMode="decimal"
            value={payUsd}
            placeholder="0.00"
            onChange={(e) => setPayUsd(e.target.value)}
          />
          <label htmlFor="payon">Day</label>
          <input
            id="payon"
            type="text"
            value={payOn}
            placeholder="2026-09-08"
            onChange={(e) => setPayOn(e.target.value)}
          />
          <label htmlFor="payaccount">Account</label>
          <input
            id="payaccount"
            type="text"
            value={payAccount}
            placeholder="ElevenLabs"
            onChange={(e) => setPayAccount(e.target.value)}
          />
          <button
            type="button"
            className="ghost"
            disabled={
              payUsd.trim() === '' ||
              Number.isNaN(Number(payUsd)) ||
              payOn.trim() === '' ||
              payAccount.trim() === ''
            }
            onClick={() => {
              void (async () => {
                try {
                  setData(
                    await savePayment(connection, {
                      usd: Number(payUsd),
                      on: payOn.trim(),
                      account: payAccount.trim(),
                    }),
                  );
                  setPayUsd('');
                  setPayOn('');
                  setPayAccount('');
                  setLastRemoved(null);
                } catch (error) {
                  setTrouble((error as Error).message);
                }
              })();
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div className="reconcile">
        <h3>Where the total comes from</h3>
        {/*
          * **Two sources, now checked against each other.** The grand total is
          * read from the ledger; the per-video figures come from each video's
          * own plan. They sat on one screen and were never compared. Session 71
          * measured the difference at $10.098150.
          */}
        <div className="paidsum">
          <span className="what">In the ledger</span>
          <span className="amount">{usd(data.reconciliation.ledgerTotalUsd)}</span>
        </div>
        <div className="paidsum">
          <span className="what">The videos above account for</span>
          <span className="amount">{usd(data.reconciliation.videosAccountForUsd)}</span>
        </div>
        <div className="paidsum">
          <span className="what">Trying things out, no video</span>
          <span className="amount">{usd(data.reconciliation.outsideAnyVideoUsd)}</span>
        </div>
        <div className="paidsum">
          <span className="what">Spent on videos, not on their record</span>
          <span className="amount">{usd(data.reconciliation.unaccountedUsd)}</span>
        </div>
        {data.reconciliation.agrees ? null : (
          <p className="disagree" role="status">
            A video claims {usd(data.reconciliation.overclaimedUsd)} more than was ever
            charged. One of the two records is wrong and nothing here has changed either.
          </p>
        )}
      </div>

      <div className="cannotsee">
        <h3>What this cannot see</h3>
        <ul>
          <li>Anything spent outside Framopia — a subscription, a tool bought elsewhere.</li>
          <li>Money you paid into an account, until you add it above.</li>
          <li>What an account has left today, until you type it at the top.</li>
        </ul>
        <p className="faint">
          None of this is broken. It is what a record of this tool&rsquo;s own spending
          can and cannot reach.
        </p>
      </div>

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
