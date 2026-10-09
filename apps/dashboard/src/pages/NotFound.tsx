import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';

export function NotFound() {
  const navigate = useNavigate();
  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <div className="text-6xl font-bold tracking-tight text-primary">404</div>
        <EmptyTitle className="text-xl">Page not found</EmptyTitle>
        <EmptyDescription>This page doesn't exist or was moved.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => navigate('/')}>Back to overview</Button>
      </EmptyContent>
    </Empty>
  );
}
