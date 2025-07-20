'use client';

import { MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ActionsPopup from '@/components/ActionsPopup';

interface BatchActionsRowProps {
  batch: {
    id: string;
    lotNumber: string | null;
    material: {
      id: string;
      name: string;
      brand: { name: string } | null;
    };
  };
  actionCellClassName?: string;
}

export default function BatchActionsRow({ batch, actionCellClassName }: BatchActionsRowProps) {
  const router = useRouter();
  return (
    <tr>
      <td className="px-4 py-2 whitespace-nowrap">{batch.lotNumber || 'N/A'}</td>
      <td className="px-4 py-2 whitespace-nowrap">
        <span className="font-medium text-blue-700 dark:text-blue-300 cursor-pointer hover:underline" onClick={() => router.push(`/inventory/${batch.material.id}`)}>
          {batch.material.name}
        </span>
      </td>
      <td className="px-4 py-2 whitespace-nowrap">{batch.material.brand?.name || 'N/A'}</td>
      <td className={`px-4 py-2 whitespace-nowrap text-right ${actionCellClassName || ''}`.trim()}>
        <ActionsPopup
          trigger={<MoreHorizontal className="w-5 h-5 cursor-pointer" />}
          actions={[
            {
              label: 'View Material Details',
              onClick: () => router.push(`/inventory/${batch.material.id}`),
            },
            {
              label: 'View Batch Usage',
              onClick: () => router.push(`/usage?advanced=1&materialId=${batch.material.id}&batchId=${batch.id}`),
              variant: 'outline',
            },
          ]}
        />
      </td>
    </tr>
  );
} 