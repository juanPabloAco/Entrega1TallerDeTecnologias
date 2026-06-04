import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 font-bold">
            M
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Multisig DApp</h1>
            <p className="text-xs text-slate-400">Sepolia · Programmatic multisig</p>
          </div>
        </div>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      </div>
    </header>
  );
}
