import type {ButtonHTMLAttributes,InputHTMLAttributes,ReactNode} from 'react';
export function AppButton(props:ButtonHTMLAttributes<HTMLButtonElement>){return <button {...props} className={`app-button ${props.className??''}`}/>}
export function AppInput(props:InputHTMLAttributes<HTMLInputElement>){return <input {...props} className={`app-input ${props.className??''}`}/>}
export function StatusBadge({children,tone='neutral'}:{children:ReactNode;tone?:string}){return <span className={`status-badge status-${tone}`}>{children}</span>}
export function EmptyState({title,description}:{title:string;description:string}){return <div role="status"><strong>{title}</strong><p>{description}</p></div>}
