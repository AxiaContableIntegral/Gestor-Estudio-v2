export default function LoginLoading() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-gradient-to-br from-slate-900 via-axia-blue to-slate-900">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden border border-white/10">
        <div className="bg-axia-blue p-10 flex flex-col items-center justify-center">
          <div className="h-28 w-40 bg-white/10 rounded-xl animate-pulse" />
        </div>
        <div className="p-8 space-y-5 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mx-auto mb-6" />
          <div className="h-12 bg-gray-100 rounded-lg" />
          <div className="h-12 bg-gray-100 rounded-lg" />
          <div className="h-12 bg-gray-200 rounded-lg mt-4" />
        </div>
      </div>
    </div>
  );
}

