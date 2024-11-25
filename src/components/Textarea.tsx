import { FC } from "react";

interface ITextareaProps {
  label?: string;
  value?: string;
  className?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export const Textarea: FC<ITextareaProps> = (props) => {
  const { className, label, value, onChange } = props;

  return (
    <div className={className}>
      <label
        htmlFor="message"
        className="block mb-2 text-sm font-medium text-gray-900"
      >
        {label}
      </label>
      <textarea
        id="message"
        rows={4}
        className="block p-2.5 w-full text-gray-900 text-sm bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 mb-2"
        placeholder="Content in JSON"
        value={value}
        onChange={onChange}
      />
    </div>
  );
};
