import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon as Loader2 } from '@solar-icons/react/linear';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { api, errorMessage } from '../lib/api';
import { Field } from './Field';

/**
 * Admin: the Founding Merchants offer shown on dvote.co ("N of 10 spots left"). Spots left =
 * total minus shops holding a spot (given on the shop's Plan box).
 */
export function FoundingSettings() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ['founding'], queryFn: api.founding });
  const [total, setTotal] = useState('10');
  const [isOpen, setIsOpen] = useState(true);
  useEffect(() => {
    if (open && data) {
      setTotal(String(data.total));
      setIsOpen(data.open);
    }
  }, [open, data]);
  const save = useMutation({
    mutationFn: () => api.setFounding({ total: Number(total), open: isOpen }),
    onSuccess: (r) => {
      qc.setQueryData(['founding'], r);
      toast.success(`Founding offer saved: ${r.left} spots left`);
      setOpen(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const valid = /^\d+$/.test(total) && Number(total) <= 100;

  return (
    <>
      <Button size="lg" variant="outline" onClick={() => setOpen(true)}>
        Founding {data ? `${data.left} / ${data.total}` : ''}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Founding Merchants</DialogTitle>
            <DialogDescription>
              30% off the plan for the first 6 months. dvote.co shows how many spots are left. {data ? `${data.taken} taken now.` : ''}
            </DialogDescription>
          </DialogHeader>
          <Field label="Total spots" htmlFor="founding-total" hint="Taken spots count too. 0–100.">
            <Input id="founding-total" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.trim())} />
          </Field>
          <div className="flex items-center gap-2">
            <Switch id="founding-open" checked={isOpen} onCheckedChange={setIsOpen} />
            <Label htmlFor="founding-open" className="font-normal">
              Offer open (shown on dvote.co, new spots can be given)
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
