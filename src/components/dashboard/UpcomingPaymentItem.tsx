interface UpcomingPaymentItemProps {
  label: string
  date: string
  amount: string
  urgent?: boolean
}

export function UpcomingPaymentItem({ label, date, amount, urgent }: UpcomingPaymentItemProps) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className={`text-center shrink-0 w-10 ${urgent ? 'text-orange-500' : 'text-gray-500'}`}>
        <p className="text-xs font-semibold uppercase leading-none">{date.split(' ')[0]}</p>
        <p className="text-base font-bold leading-none mt-0.5">{date.split(' ')[1]}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 font-medium truncate">{label}</p>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        <span className={`text-sm font-semibold ${urgent ? 'text-orange-600' : 'text-gray-800'}`}>
          {amount}
        </span>
        <button className="text-xs font-medium text-blue-700 hover:text-blue-800 hover:underline">
          Pagar
        </button>
      </div>
    </div>
  )
}
