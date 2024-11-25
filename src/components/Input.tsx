import { FC, useState } from "react";
import { twMerge } from "tailwind-merge";

interface IInputProps {
  placeholder?: string;
  type?: string;
  value: string;
  className?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Input: FC<IInputProps> = (props) => {
  const { className, placeholder, type = "text", value, onChange } = props;
  const iconEye = type === "password";
  const [isPassword, setIsPassword] = useState(iconEye);

  return (
    <div className="relative w-full">
      <input
        value={value}
        onChange={onChange}
        type={isPassword ? "password" : "text"}
        className={twMerge(
          "min-w-80 mr-2 block w-full rounded-md border-0 py-2 px-4 text-gray-900 placeholder:text-gray-400 sm:text-sm/6",
          iconEye && "pr-11",
          className
        )}
        placeholder={placeholder}
      />

      <div className="absolute -translate-y-1/2 cursor-pointer right-4 top-1/2">
        {iconEye && (
          <button
            type="button"
            onClick={() => setIsPassword((s) => !s)}
            data-hs-toggle-password='{
              "target": "#hs-toggle-password"
            }'
            className="absolute inset-y-0 end-0 flex items-center z-20 px-3 cursor-pointer text-gray-400 rounded-e-md focus:outline-none focus:text-main-600 dark:text-neutral-600 dark:focus:text-main-500"
          >
            <svg
              className="shrink-0 size-3.5"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                className="hs-password-active:hidden"
                d="M9.88 9.88a3 3 0 1 0 4.24 4.24"
              ></path>
              <path
                className="hs-password-active:hidden"
                d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
              ></path>
              <path
                className="hs-password-active:hidden"
                d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"
              ></path>
              <line
                className="hs-password-active:hidden"
                x1="2"
                x2="22"
                y1="2"
                y2="22"
              ></line>
              <path
                className="hidden hs-password-active:block"
                d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"
              ></path>
              <circle
                className="hidden hs-password-active:block"
                cx="12"
                cy="12"
                r="3"
              ></circle>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
