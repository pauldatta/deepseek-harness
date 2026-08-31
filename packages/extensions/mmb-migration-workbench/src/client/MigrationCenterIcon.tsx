import type { ReactElement } from 'react'

export interface IconProps {
  size?: number
  className?: string
}

/**
 * Migration Center Cloud Workbench Icon.
 */
export function MigrationCenterIcon({ size = 16, className }: IconProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Cloud Base */}
      <path
        d="M12.5 10.5H13C14.1046 10.5 15 9.60457 15 8.5C15 7.43554 14.1685 6.56543 13.1199 6.50428C12.8753 4.22384 10.9416 2.5 8.5 2.5C6.39867 2.5 4.65476 3.86477 4.14801 5.76722C3.9056 5.67909 3.64414 5.63158 3.37143 5.63158C2.06171 5.63158 1 6.69329 1 8.00301C1 9.24867 1.9542 10.2709 3.17647 10.3662"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Forward Migration Arrow */}
      <path
        d="M5 11.5L8 8.5L11 11.5"
        stroke="#34A853"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 8.5V14.5"
        stroke="#4285F4"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}
