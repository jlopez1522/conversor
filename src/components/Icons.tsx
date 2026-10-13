interface IconProps { className?: string }

export function LogoMark({ className = 'h-9 w-9' }: IconProps) {
  return <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#175C48"/><path d="M10 21h3l2-8 4 16 4-19 3 11h4" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function LockIcon({ className = 'h-4 w-4' }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
}

export function UploadIcon({ className = 'h-7 w-7' }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/></svg>;
}
