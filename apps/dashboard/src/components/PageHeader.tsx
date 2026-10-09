import { Flex, Typography } from 'antd';
import type { ReactNode } from 'react';

/** Page title + one line of context on the left, actions on the right. */
export function PageHeader({ title, subtitle, extra }: { title: ReactNode; subtitle?: ReactNode; extra?: ReactNode }) {
  return (
    <Flex align="center" justify="space-between" gap={16} wrap style={{ marginBottom: 24 }}>
      <div>
        <Typography.Title level={2} className="page-title">
          {title}
        </Typography.Title>
        {subtitle ? (
          <Typography.Text type="secondary" style={{ fontSize: 15 }}>
            {subtitle}
          </Typography.Text>
        ) : null}
      </div>
      {extra}
    </Flex>
  );
}

/** Small numbers formatted the same everywhere: 12,345. */
export const num = (n: number) => n.toLocaleString('en-US');
