import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-bold text-[#FF6B35] mb-4">404</h1>
      <h2 className="text-xl text-white/80 mb-6">Page not found</h2>
      <p className="text-white/50 mb-8 max-w-md">
        The play you&apos;re looking for doesn&apos;t exist in our playbook.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-[#FF6B35] text-white rounded-xl hover:bg-[#FF6B35]/90 transition-colors no-underline font-medium"
      >
        Back to Explore
      </Link>
    </div>
  );
}
