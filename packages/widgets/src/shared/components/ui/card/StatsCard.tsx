import { Card, CardContent, CardTitle } from '@widgets/components/ui/card';

export const StatsCard = ({
  title,
  content
}: {
  title: React.ReactElement | string;
  content: React.ReactElement;
}): React.ReactElement => {
  return (
    <Card variant="stats">
      <CardTitle>{title}</CardTitle>
      <CardContent className="mt-1">{content}</CardContent>
    </Card>
  );
};
