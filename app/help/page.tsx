export default function HelpPage() {
  return (
    <main className="flex min-h-screen flex-col bg-blue-50 px-4 py-12 text-slate-800 pb-32">
      <h1 className="text-3xl font-semibold">Как играть</h1>
      <p className="mt-4 text-lg">Угадайте слово за 6 попыток.</p>
      
      <div className="mt-6 space-y-4">
        <p className="text-sm">• Каждая догадка должна быть валидным словом нужной длины.</p>
        <p className="text-sm">• Цвет плиток показывает, насколько близко ваша догадка к слову.</p>
      </div>

      <div className="mt-8 space-y-6">
        <div>
          <div className="flex gap-1 mb-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-blue-200 bg-green-500 text-xl font-semibold text-white">
              С
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-blue-200 bg-white text-xl font-semibold text-slate-800 opacity-60">
              Л
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-blue-200 bg-white text-xl font-semibold text-slate-800 opacity-60">
              О
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-blue-200 bg-white text-xl font-semibold text-slate-800 opacity-60">
              В
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-blue-200 bg-white text-xl font-semibold text-slate-800 opacity-60">
              О
            </div>
          </div>
          <p className="text-sm text-slate-600">С находится в слове и в правильной позиции.</p>
        </div>

        <div>
          <div className="flex gap-1 mb-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-blue-200 bg-white text-xl font-semibold text-slate-800 opacity-60">
              К
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-blue-200 bg-yellow-400 text-xl font-semibold text-slate-800">
              Р
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-blue-200 bg-white text-xl font-semibold text-slate-800 opacity-60">
              А
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-blue-200 bg-white text-xl font-semibold text-slate-800 opacity-60">
              С
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-blue-200 bg-white text-xl font-semibold text-slate-800 opacity-60">
              К
            </div>
          </div>
          <p className="text-sm text-slate-600">Р находится в слове, но в неправильной позиции.</p>
        </div>

        <div>
          <div className="flex gap-1 mb-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-blue-200 bg-white text-xl font-semibold text-slate-800 opacity-60">
              М
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-blue-200 bg-white text-xl font-semibold text-slate-800 opacity-60">
              О
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-blue-200 bg-white text-xl font-semibold text-slate-800 opacity-60">
              С
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-blue-200 bg-gray-300 text-xl font-semibold text-slate-800 opacity-80">
              К
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-blue-200 bg-white text-xl font-semibold text-slate-800 opacity-60">
              А
            </div>
          </div>
          <p className="text-sm text-slate-600">К не находится в слове ни в какой позиции.</p>
        </div>
      </div>
    </main>
  );
}
