/**
 * Modal for selecting contract templates.
 */

import type React from 'react';
import { FileCode2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TEMPLATES } from '@/lib/templates';

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (templateId: string) => void;
}

export function TemplateSelector({
  open,
  onOpenChange,
  onSelect,
}: TemplateSelectorProps): React.ReactElement {
  const handleSelect = (templateId: string): void => {
    onSelect(templateId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5" />
            Contract Templates
          </DialogTitle>
          <DialogDescription>
            Choose a template to start with. Your current code will be replaced.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 sm:grid-cols-2">
          {TEMPLATES.map(template => (
            <TemplateCard
              key={template.id}
              name={template.name}
              description={template.description}
              onClick={() => handleSelect(template.id)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface TemplateCardProps {
  name: string;
  description: string;
  onClick: () => void;
}

function TemplateCard({ name, description, onClick }: TemplateCardProps): React.ReactElement {
  return (
    <Card className="cursor-pointer transition-colors hover:bg-accent/50" onClick={onClick}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCode2 className="h-4 w-4" />
          {name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="line-clamp-2">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
