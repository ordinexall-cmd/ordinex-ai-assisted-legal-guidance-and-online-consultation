import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  lawyerVerificationApi,
  type GovIdType,
  type LawyerVerificationRecord,
  type LawyerVerificationState,
  type LawyerVerificationStatus,
  type UserProfile,
} from '../../services/api';
import { getErrorMessage } from '../../utils/userFacingError';
import { ImageCaptureField } from '../ui/ImageCaptureField';

interface Props {
  readonly user: UserProfile;
  readonly onUpdated: (user: UserProfile) => void;
  /** Full-page onboarding uses wider layout and post-verify CTAs. */
  readonly variant?: 'settings' | 'page';
  readonly onVerified?: () => void;
  readonly useKycToken?: boolean;
  readonly panelMode?: boolean;
  readonly applicantEmail?: string;
}

type WizardStep = 'roll' | 'id' | 'selfie' | 'payment' | 'decide' | 'done';

const ID_OPTIONS: { value: GovIdType; label: string }[] = [
  { value: 'PRC', label: 'PRC Professional ID' },
  { value: 'IBP_ID', label: 'IBP Lawyer ID' },
  { value: 'DRIVER', label: 'Driver License' },
  { value: 'PASSPORT', label: 'Philippine Passport' },
  { value: 'UMID', label: 'UMID' },
  { value: 'PHL_ID', label: 'PhilSys (National ID)' },
  { value: 'VOTER', label: 'Voter ID / VRN' },
  { value: 'POSTAL', label: 'Postal ID' },
  { value: 'NBI', label: 'NBI Clearance ID' },
];

function statusPill(status: LawyerVerificationStatus): { tone: 'ok' | 'warn' | 'bad' | 'info'; label: string } {
  switch (status) {
    case 'VERIFIED': return { tone: 'ok', label: 'Verified counsel' };
    case 'PROCESSING': return { tone: 'info', label: 'Reviewing identity' };
    case 'PENDING_UPLOAD': return { tone: 'info', label: 'Awaiting uploads' };
    case 'NEEDS_REUPLOAD': return { tone: 'warn', label: 'Needs better photo' };
    case 'REJECTED': return { tone: 'bad', label: 'Verification rejected' };
    default: return { tone: 'info', label: 'Verification not started' };
  }
}

function stepFromVerification(v: LawyerVerificationRecord | null): WizardStep {
  if (!v) return 'roll';
  if (!v.rollMatchHit) return 'roll';
  if (!v.govIdUrl) return 'id';
  if (!v.selfieUrl || !v.challengeCodeMatched) return 'selfie';
  if (v.paymentNameMatchScore == null) return 'payment';
  if (v.decision === 'PENDING') return 'decide';
  return 'done';
}

export const LawyerVerificationWizard: React.FC<Props> = ({
  user,
  onUpdated,
  variant = 'settings',
  onVerified,
  useKycToken = false,
  panelMode = false,
  applicantEmail,
}) => {
  const kycOpts = useKycToken ? { useKycToken: true as const } : undefined;
  const [state, setState] = useState<LawyerVerificationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState<WizardStep>('roll');

  // Form state
  const [fullName, setFullName] = useState(user.name);
  const [rollNumber, setRollNumber] = useState(user.barNumber || '');
  const [govIdType, setGovIdType] = useState<GovIdType>('PRC');
  const idInputRef = useRef<HTMLInputElement>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [reportedCode, setReportedCode] = useState('');
  const [paymentAccountName, setPaymentAccountName] = useState('');

  useEffect(() => {
    let alive = true;
    lawyerVerificationApi.getState(kycOpts)
      .then((s) => { if (alive) { setState(s); setStep(stepFromVerification(s.verification)); } })
      .catch((e) => { if (alive) setError(getErrorMessage(e, 'Could not load verification state.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const tier = useMemo(() => {
    if (!state) return null;
    if (state.score == null) return null;
    if (state.score >= state.thresholds.high) return 'high';
    if (state.score >= state.thresholds.medium) return 'medium';
    return 'low';
  }, [state]);

  const refreshState = async () => {
    const s = await lawyerVerificationApi.getState(kycOpts);
    setState(s);
    setStep(stepFromVerification(s.verification));
  };

  const panelStepMap: Record<WizardStep, 'roll' | 'id' | 'selfie' | 'payment' | 'decide' | null> = {
    roll: 'roll',
    id: 'id',
    selfie: 'selfie',
    payment: 'payment',
    decide: 'decide',
    done: null,
  };

  const handlePanelAdvance = async () => {
    const panelStep = panelStepMap[step];
    if (!panelStep) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const out = await lawyerVerificationApi.panelAdvance(
        panelStep,
        {
          fullName: fullName.trim(),
          rollNumber: rollNumber.trim(),
          paymentAccountName: paymentAccountName.trim(),
        },
        kycOpts,
      );
      await refreshState();
      if (panelStep === 'decide') {
        if (out.decision === 'AUTO_APPROVE') {
          setStep('done');
          setSuccess('Verified. Check your email and sign in from the home page.');
          onVerified?.();
        } else {
          setError(out.reason || 'Verification did not pass.');
        }
        return;
      }
      const next: WizardStep =
        panelStep === 'roll' ? 'id'
          : panelStep === 'id' ? 'selfie'
            : panelStep === 'selfie' ? 'payment'
              : 'decide';
      setStep(next);
      setSuccess('Demo step recorded.');
    } catch (err) {
      setError(getErrorMessage(err, 'Panel advance failed.'));
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !rollNumber.trim()) {
      setError('Enter your full legal name and SC Roll number.');
      return;
    }
    setBusy(true); setError(''); setSuccess('');
    try {
      const out = await lawyerVerificationApi.start({ fullName: fullName.trim(), rollNumber: rollNumber.trim() }, kycOpts);
      await refreshState();
      if (out.ok) {
        setSuccess('Roll number matched. Upload your government ID next.');
        setStep('id');
      } else if (out.code === 'COOLDOWN') {
        setError(out.message);
      } else {
        setError(out.message);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not start verification.'));
    } finally {
      setBusy(false);
    }
  };

  const handleUploadId = async () => {
    if (!idFile) { setError('Choose a clear photo of the front of your ID.'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      await lawyerVerificationApi.uploadId(idFile, govIdType, kycOpts);
      await refreshState();
      setSuccess('ID accepted. Continue with the selfie + handwritten code.');
      setStep('selfie');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not upload ID.'));
    } finally {
      setBusy(false);
    }
  };

  const handleReissueCode = async () => {
    setBusy(true); setError('');
    try {
      const out = await lawyerVerificationApi.reissue(kycOpts);
      setState((prev) => prev ? { ...prev, verification: out.verification ?? prev.verification } : prev);
      setSuccess(`New challenge code issued: ${out.challengeCode}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not reissue challenge code.'));
    } finally {
      setBusy(false);
    }
  };

  const handleUploadSelfie = async () => {
    if (!selfieFile) { setError('Take or upload your verification photo.'); return; }
    if (!reportedCode.trim()) { setError('Type the handwritten challenge code you used.'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      await lawyerVerificationApi.uploadSelfie(selfieFile, reportedCode.trim(), kycOpts);
      await refreshState();
      setSuccess('Selfie uploaded. Add your payout account name (optional) or skip to decide.');
      setStep('payment');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not upload selfie.'));
    } finally {
      setBusy(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentAccountName.trim()) {
      setError('Enter the account holder name as it appears on your GCash or bank account.');
      return;
    }
    setBusy(true); setError(''); setSuccess('');
    try {
      await lawyerVerificationApi.setPaymentName(paymentAccountName.trim(), kycOpts);
      await refreshState();
      setSuccess('Payment account recorded. Run final check next.');
      setStep('decide');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save payment name.'));
    } finally {
      setBusy(false);
    }
  };

  const handleSkipPayment = () => { setStep('decide'); };

  const handleDecide = async () => {
    setBusy(true); setError(''); setSuccess('');
    try {
      const out = await lawyerVerificationApi.decide(kycOpts);
      setState((prev) => prev ? {
        ...prev,
        status: out.status,
        score: out.score,
        rejectionReason: out.decision === 'AUTO_REJECT' ? out.reason : null,
        cooldownUntil: out.cooldownUntil,
        verification: out.verification ?? prev.verification,
      } : prev);
      onUpdated(out.user);
      setStep('done');
      if (out.decision === 'AUTO_APPROVE') {
        if (useKycToken || out.sessionAction === 'sign_in_required') {
          setSuccess(
            `Identity verified (${out.score}% confidence). We emailed ${applicantEmail || user.email}. Sign in when ready.`,
          );
        } else {
          setSuccess(`Identity verified with ${out.score}% confidence. You are now a verified counsel on Ordinex.`);
        }
        onVerified?.();
      } else if (out.decision === 'NEEDS_REUPLOAD') {
        setError(out.reason);
      } else {
        setError(out.reason);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Final verification check failed.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="workbench-panel-helper">Loading verification…</p>;
  }
  if (!state) {
    return <p className="landing-form-error">Verification is unavailable right now.</p>;
  }

  const pill = statusPill(state.status);
  const v = state.verification;

  const renderStatusHeader = () => (
    <div className="lawyer-verify-status">
      <div className={`lawyer-verify-status__pill lawyer-verify-status__pill--${pill.tone}`}>
        <span className="material-symbols-outlined" aria-hidden>
          {pill.tone === 'ok' ? 'verified' : pill.tone === 'bad' ? 'gpp_bad' : 'gpp_maybe'}
        </span>
        <span>{pill.label}</span>
      </div>
      {state.score != null && (
        <p className="lawyer-verify-status__score">
          AI confidence: <strong>{state.score}%</strong> (high ≥ {state.thresholds.high}%, medium ≥ {state.thresholds.medium}%)
        </p>
      )}
      {state.rejectionReason && (
        <p className="lawyer-verify-status__reason">{state.rejectionReason}</p>
      )}
      {state.cooldownUntil && (
        <p className="lawyer-verify-status__reason">
          Cooldown until {new Date(state.cooldownUntil).toLocaleDateString()}.
        </p>
      )}
    </div>
  );

  return (
    <div className={`lawyer-verify-wizard${variant === 'page' ? ' lawyer-verify-wizard--page' : ''}`}>
      {renderStatusHeader()}

      <ol className="lawyer-verify-steps">
        {(['roll', 'id', 'selfie', 'payment', 'decide'] as WizardStep[]).map((s, idx) => {
          const reached =
            (s === 'roll') ||
            (s === 'id' && !!v?.rollMatchHit) ||
            (s === 'selfie' && !!v?.govIdUrl) ||
            (s === 'payment' && !!v?.selfieUrl) ||
            (s === 'decide' && !!v?.selfieUrl);
          const active = step === s;
          const cls = `lawyer-verify-steps__item${active ? ' is-active' : ''}${reached ? ' is-reached' : ''}`;
          const labels = ['Roll match', 'Government ID', 'ID-in-hand photo', 'Payment name', 'AI decide'];
          return (
            <li key={s} className={cls}>
              <span className="lawyer-verify-steps__num">{idx + 1}</span>
              <span className="lawyer-verify-steps__lbl">{labels[idx]}</span>
            </li>
          );
        })}
      </ol>

      {step === 'roll' && (
        <form onSubmit={handleStart} className="lawyer-verify-form">
          <p className="workbench-panel-helper">
            Enter your full legal name and SC Roll number exactly as printed on your bar admission record.
            We cross-check against the seeded Roll of Attorneys before allowing ID upload.
          </p>
          <label className="ox-label">Full legal name</label>
          <input className="ox-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <label className="ox-label">SC Roll number</label>
          <input className="ox-input" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} placeholder="e.g. 12345" />
          {panelMode ? (
            <button type="button" className="ox-btn ox-btn-primary" disabled={busy} onClick={() => void handlePanelAdvance()}>
              {busy ? 'Advancing…' : 'Next step (demo)'}
            </button>
          ) : (
            <button type="submit" className="ox-btn ox-btn-primary" disabled={busy}>
              {busy ? 'Checking…' : 'Check roll match'}
            </button>
          )}
        </form>
      )}

      {step === 'id' && (
        <div className="lawyer-verify-form">
          <p className="workbench-panel-helper">
            Upload a clear photo of the FRONT of your government-issued ID. Best results: bright, no glare,
            corners visible, name readable. <strong>Recommended for lawyers: IBP Lawyer ID or PRC ID.</strong>
          </p>
          <label className="ox-label">ID type</label>
          <select className="ox-select" value={govIdType} onChange={(e) => setGovIdType(e.target.value as GovIdType)}>
            {ID_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <input
            ref={idInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setIdFile(e.target.files?.[0] || null)}
          />
          {idFile && (
            <p className="lawyer-verify-form__hint">{idFile.name} ({(idFile.size / 1024).toFixed(0)} KB)</p>
          )}
          {panelMode ? (
            <button type="button" className="ox-btn ox-btn-primary" disabled={busy} onClick={() => void handlePanelAdvance()}>
              {busy ? 'Advancing…' : 'Next step (demo)'}
            </button>
          ) : (
            <button type="button" className="ox-btn ox-btn-primary" disabled={busy} onClick={() => void handleUploadId()}>
              {busy ? 'Uploading…' : 'Upload ID'}
            </button>
          )}
        </div>
      )}

      {step === 'selfie' && (
        <div className="lawyer-verify-form">
          <div className="lawyer-verify-selfie-guide">
            <h3 className="lawyer-verify-selfie-guide__title">Verification photo (required)</h3>
            <p className="lawyer-verify-selfie-guide__lead">
              This is <strong>not</strong> a plain selfie. Write <strong>only</strong> the security code Ordinex shows
              below on blank paper — <strong>not</strong> your name, signature, or bar number.
            </p>
            <ol className="lawyer-verify-selfie-guide__list">
              <li>Hold the <strong>same government ID</strong> you uploaded (front visible, not covered by fingers).</li>
              <li>Hold a <strong>handwritten note</strong> with <strong>only</strong> today&apos;s security code (large, readable).</li>
              <li>Your <strong>face</strong> clearly visible — good lighting, no filters, sunglasses, or hats.</li>
            </ol>
            <div className="lawyer-verify-selfie-guide__diagram" aria-hidden>
              <svg viewBox="0 0 280 120" width="280" height="120" role="img">
                <circle cx="55" cy="42" r="22" fill="rgba(26,92,71,0.15)" stroke="rgba(13,59,46,0.35)" />
                <text x="55" y="48" textAnchor="middle" fontSize="11" fill="rgba(13,59,46,0.7)">Face</text>
                <rect x="105" y="28" width="52" height="34" rx="4" fill="rgba(184,146,46,0.2)" stroke="rgba(154,122,36,0.5)" />
                <text x="131" y="50" textAnchor="middle" fontSize="10" fill="rgba(13,59,46,0.7)">ID</text>
                <rect x="175" y="22" width="88" height="48" rx="3" fill="#fffefb" stroke="rgba(13,59,46,0.35)" />
                <text x="219" y="42" textAnchor="middle" fontSize="9" fill="rgba(13,59,46,0.65)">ORD-…</text>
                <text x="219" y="58" textAnchor="middle" fontSize="8" fill="rgba(13,59,46,0.5)">code only</text>
              </svg>
            </div>
            <ul className="lawyer-verify-selfie-guide__dont">
              <li>Do not use an old photo or screenshot.</li>
              <li>The code you type below must match the note in your photo.</li>
            </ul>
          </div>

          {v?.challengeCode && (
            <div className="lawyer-verify-code">
              <span className="material-symbols-outlined">edit_note</span>
              <div>
                <span className="lawyer-verify-code__label">Write this on your note</span>
                <code>{v.challengeCode}</code>
              </div>
              <button type="button" className="ox-btn ox-btn-ghost" disabled={busy} onClick={() => void handleReissueCode()}>
                Reissue
              </button>
            </div>
          )}

          <ImageCaptureField
            label="Verification photo"
            file={selfieFile}
            onFileChange={setSelfieFile}
            disabled={busy}
            captureFileName="verification-selfie.jpg"
          />

          <label className="ox-label">Type the code from your handwritten note</label>
          <input
            className="ox-input"
            value={reportedCode}
            onChange={(e) => setReportedCode(e.target.value)}
            placeholder="ORD-YYYY-MMDD-XXXX"
            autoComplete="off"
            spellCheck={false}
          />

          {panelMode ? (
            <button type="button" className="ox-btn ox-btn-primary" disabled={busy} onClick={() => void handlePanelAdvance()}>
              {busy ? 'Advancing…' : 'Next step (demo)'}
            </button>
          ) : (
            <button type="button" className="ox-btn ox-btn-primary" disabled={busy} onClick={() => void handleUploadSelfie()}>
              {busy ? 'Uploading…' : 'Upload verification photo'}
            </button>
          )}
        </div>
      )}

      {step === 'payment' && (
        <div className="lawyer-verify-form">
          <p className="workbench-panel-helper">
            Optional but recommended: name on your GCash or bank account. We compare it against your SC Roll
            entry — banks already do strong KYC, so a match adds a second layer of identity proof.
          </p>
          <label className="ox-label">Payment account name</label>
          <input
            className="ox-input"
            value={paymentAccountName}
            onChange={(e) => setPaymentAccountName(e.target.value)}
            placeholder="Juan Dela Cruz"
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {panelMode ? (
              <>
                <button type="button" className="ox-btn ox-btn-primary" disabled={busy} onClick={() => void handlePanelAdvance()}>
                  {busy ? 'Advancing…' : 'Next step (demo)'}
                </button>
                <button type="button" className="ox-btn ox-btn-ghost" onClick={handleSkipPayment}>
                  Skip
                </button>
              </>
            ) : (
              <>
                <button type="button" className="ox-btn ox-btn-primary" disabled={busy} onClick={() => void handlePayment()}>
                  {busy ? 'Saving…' : 'Save & continue'}
                </button>
                <button type="button" className="ox-btn ox-btn-ghost" onClick={handleSkipPayment}>
                  Skip
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {step === 'decide' && (
        <div className="lawyer-verify-form">
          <p className="workbench-panel-helper">
            Run the AI confidence aggregation. We combine face match, ID OCR name match, SC Roll match,
            challenge code, and (if provided) payment name into a single score.
          </p>
          {v && (
            <ul className="lawyer-verify-signals">
              <li>SC Roll match: <strong>{v.rollMatchHit ? 'Yes' : 'No'}</strong></li>
              <li>Government ID uploaded: <strong>{v.govIdUrl ? 'Yes' : 'No'}</strong></li>
              <li>Selfie + challenge code matched: <strong>{v.challengeCodeMatched ? 'Yes' : 'No'}</strong></li>
              <li>Face match score: <strong>{v.faceMatchScore != null ? `${Math.round(v.faceMatchScore * 100)}%` : '—'}</strong></li>
              <li>ID OCR name vs roll name: <strong>{v.ocrNameMatchScore != null ? `${Math.round(v.ocrNameMatchScore * 100)}%` : '—'}</strong></li>
              <li>Payment name match: <strong>{v.paymentNameMatchScore != null ? `${Math.round(v.paymentNameMatchScore * 100)}%` : '—'}</strong></li>
            </ul>
          )}
          {panelMode ? (
            <button type="button" className="ox-btn ox-btn-primary" disabled={busy} onClick={() => void handlePanelAdvance()}>
              {busy ? 'Running…' : 'Run verification (demo)'}
            </button>
          ) : (
            <button type="button" className="ox-btn ox-btn-primary" disabled={busy} onClick={() => void handleDecide()}>
              {busy ? 'Running AI check…' : 'Run final verification'}
            </button>
          )}
        </div>
      )}

      {step === 'done' && (
        <div className="lawyer-verify-form">
          {tier === 'high' && (
            <>
              <p className="callout-success__text" style={{ color: 'var(--color-ox-emerald)' }}>
                {useKycToken
                  ? 'Auto-approved. Check your email and sign in from the home page.'
                  : 'Auto-approved. Your verified counsel badge is now visible to citizens.'}
              </p>
              {variant === 'page' && !useKycToken && (
                <div className="lawyer-onboarding-done-actions" style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <a href="/settings" className="ox-btn ox-btn-secondary">Complete public profile</a>
                  <button type="button" className="ox-btn ox-btn-primary" onClick={() => onVerified?.()}>
                    Go to dashboard
                  </button>
                </div>
              )}
              {useKycToken && (
                <button type="button" className="ox-btn ox-btn-primary" style={{ marginTop: 12 }} onClick={() => onVerified?.()}>
                  Continue
                </button>
              )}
            </>
          )}
          {tier === 'medium' && (
            <>
              <p className="lawyer-verify-status__reason">
                Borderline match — please re-upload your ID and selfie under better lighting, then run final check again.
              </p>
              <button type="button" className="ox-btn ox-btn-primary" onClick={() => setStep('id')}>
                Re-upload ID
              </button>
            </>
          )}
          {tier === 'low' && (
            <p className="lawyer-verify-status__reason">
              Verification was rejected. You may try again after the cooldown period above.
            </p>
          )}
        </div>
      )}

      {error && <p className="landing-form-error">{error}</p>}
      {success && <p className="landing-form-success">{success}</p>}
    </div>
  );
};

export default LawyerVerificationWizard;
