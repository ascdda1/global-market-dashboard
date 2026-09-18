export default function BrandLogo() {
  return (
    <svg
      aria-hidden="true"
      className="brand-logo"
      fill="none"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle className="brand-logo-ring" cx="24" cy="24" r="18.5" />
      <path className="brand-logo-grid" d="M6.5 24h35M24 5.5c-5.2 5-8 11.4-8 18.5s2.8 13.5 8 18.5M24 5.5c5.2 5 8 11.4 8 18.5 0 2.1-.3 4.2-.8 6.2" />
      <path className="brand-logo-trend" d="m12 31 7.1-7.1 5 4.2L36 16.2" />
      <path className="brand-logo-arrow" d="M29.7 16.2H36v6.3" />
    </svg>
  );
}
