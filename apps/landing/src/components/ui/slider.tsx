import * as React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

/** A horizontal slider (one or more thumbs); follows the reading direction in Arabic. */
function Slider({ className, defaultValue, value, min = 0, max = 100, thumbLabel, thumbValueText, ...props }: React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabel?: string; thumbValueText?: string }) {
  const thumbs = Array.isArray(value) ? value.length : Array.isArray(defaultValue) ? defaultValue.length : 1;
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn('relative flex h-5 w-full touch-none items-center select-none data-[disabled]:opacity-50', className)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="relative h-1 w-full grow overflow-hidden rounded-full bg-black/[0.08]">
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbs }, (_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          data-slot="slider-thumb"
          aria-label={thumbLabel}
          aria-valuetext={thumbValueText}
          className="relative block size-6 shrink-0 cursor-grab rounded-full border-[5px] border-white bg-ink shadow-[0_1px_4px_rgb(0_0_0/0.25)] ring-ring/50 transition-[box-shadow] duration-100 ease-linear after:absolute after:-inset-2 hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
