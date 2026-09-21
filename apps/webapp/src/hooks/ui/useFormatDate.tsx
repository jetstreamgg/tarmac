import { useEffect, useState } from 'react';
import { formatDate, getDateLocale } from '../../utils/formatDate';

const formatDatesArray = async (dates: Date[], locale?: string, format?: string) => {
  const dateLocale = await getDateLocale(locale || '');

  return dates.map((date: Date) => {
    return formatDate(date, dateLocale, format);
  });
};

export const useFormatDates = (dates?: Date[], locale?: string, format?: string) => {
  const [formatted, setFormatted] = useState<string[]>([]);

  useEffect(() => {
    const fetchFormattedDates = async () => {
      if (dates) {
        setFormatted(await formatDatesArray(dates, locale, format));
      }
    };

    fetchFormattedDates();
  }, [dates, locale, format]);

  return formatted;
};
