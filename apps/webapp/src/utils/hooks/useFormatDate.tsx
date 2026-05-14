import { useEffect, useState } from 'react';
import { formatDate, getDateLocale } from '../formatDate';

export const useFormatDate = (date: Date, locale?: string, format?: string) => {
  const [formattedDate, setFormattedDate] = useState<string>('');

  useEffect(() => {
    const formatAndSetDate = async () => {
      const dateLocale = await getDateLocale(locale || '');
      const result = formatDate(date, dateLocale, format);
      setFormattedDate(result);
    };

    formatAndSetDate();
  }, [date, locale, format]);

  return formattedDate;
};

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
  }, [dates]);

  return formatted;
};
