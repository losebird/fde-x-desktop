export const kitFocus = 'focus-visible:outline-none focus-visible:shadow-kit-ring'

export const kitControl = [
  'w-full rounded-kit border border-kit-line bg-kit-card px-2.5 text-kit text-kit-ink',
  'placeholder:text-kit-tertiary',
  'transition-[border-color,box-shadow] duration-kit ease-kit',
  'focus:outline-none focus:border-kit-brand focus:shadow-kit-ring',
  'disabled:cursor-not-allowed disabled:bg-kit-muted disabled:text-kit-secondary',
  'aria-[invalid=true]:border-kit-danger aria-[invalid=true]:focus:shadow-none',
].join(' ')
