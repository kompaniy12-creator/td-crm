import * as React from 'react'
import { cn } from '@/lib/utils/cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string; error?: string; hint?: string; leftIcon?: React.ReactNode; rightIcon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, type = 'text', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1">
        {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">{label}</label>}
        <div className="relative">
          {leftIcon && <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">{leftIcon}</div>}
          <input id={inputId} type={type} ref={ref} className={cn('block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50', error && 'border-red-500 focus:border-red-500 focus:ring-red-500', leftIcon && 'pl-10', rightIcon && 'pr-10', className)} {...props} />
          {rightIcon && <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">{rightIcon}</div>}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
