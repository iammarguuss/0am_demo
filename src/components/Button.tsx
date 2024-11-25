import { FC } from "react";
import { twMerge } from "tailwind-merge";

interface IButton {
  label: string;
  className?: string;
  onClick?: () => void;
}

export const Button: FC<IButton> = (props) => {
  const { className, label, onClick } = props;

  return (
    <button
      className={twMerge(
        "bg-main-500 hover:bg-main-600 text-white py-1 px-2 rounded",
        className
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
};
