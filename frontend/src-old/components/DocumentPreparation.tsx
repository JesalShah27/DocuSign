import React, { useState, useRef, useEffect } from 'react';
import PDFPreview from './PDFPreview';
import { 
  PencilIcon, 
  CalendarDaysIcon, 
  DocumentTextIcon,
  CheckIcon,
  ArrowPathIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import '../styles/field-positioning.css';

interface Field {
  id: string;
  type: 'SIGNATURE' | 'DATE' | 'TEXT' | 'CHECKBOX' | 'INITIAL';
  signerId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  label?: string;
  fontFamily?: string;
  fontSize?: number;
}

interface Signer {
  id: string;
  name: string;
  email: string;
  role: string;
  routingOrder: number;
}

interface DocumentPreparationProps {
  documentUrl: string;
  signers: Signer[];
  fields: Field[];
  onFieldAdd: (field: Omit<Field, 'id'>) => void;
  onFieldUpdate: (field: Field) => void;
  onFieldDelete: (fieldId: string) => void;
}

const DocumentPreparation: React.FC<DocumentPreparationProps> = ({
  documentUrl,
  signers,
  fields,
  onFieldAdd,
  onFieldUpdate,
  onFieldDelete
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTool, setSelectedTool] = useState<Field['type'] | null>(null);
  const [selectedSigner, setSelectedSigner] = useState<string | null>(null);
  const [currentField, setCurrentField] = useState<Field | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [scale, setScale] = useState(1);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState(0);

  useEffect(() => {
    // Reset state when document changes
    setCurrentPage(1);
    setSelectedTool(null);
    setSelectedSigner(null);
    setCurrentField(null);
    setIsDrawing(false);
  }, [documentUrl]);

  const handleToolSelect = (tool: Field['type']) => {
    setSelectedTool(tool);
    setCurrentField(null);
  };

  const handleSignerSelect = (signerId: string) => {
    setSelectedSigner(signerId);
    setCurrentField(null);
  };

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedTool || !selectedSigner || !pdfContainerRef.current) return;

    const rect = pdfContainerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = pageHeight - ((e.clientY - rect.top) / scale);

    // Default sizes based on field type
    let width = 150;
    let height = 50;
    switch (selectedTool) {
      case 'SIGNATURE':
        width = 200;
        height = 60;
        break;
      case 'DATE':
        width = 120;
        height = 40;
        break;
      case 'CHECKBOX':
        width = 30;
        height = 30;
        break;
      case 'INITIAL':
        width = 100;
        height = 50;
        break;
    }

    onFieldAdd({
      type: selectedTool,
      signerId: selectedSigner,
      page: currentPage,
      x,
      y,
      width,
      height,
      required: true,
      label: `${selectedTool.charAt(0) + selectedTool.slice(1).toLowerCase()} Field`
    });
  };

  const handleFieldDrag = (field: Field, deltaX: number, deltaY: number) => {
    const newX = field.x + (deltaX / scale);
    const newY = field.y - (deltaY / scale);

    onFieldUpdate({
      ...field,
      x: newX,
      y: newY
    });
  };

  const handleFieldResize = (field: Field, width: number, height: number) => {
    onFieldUpdate({
      ...field,
      width: width / scale,
      height: height / scale
    });
  };

  const renderField = (field: Field) => {
    const isSelected = currentField?.id === field.id;
    const signer = signers.find(s => s.id === field.signerId);

    const fieldStyle: React.CSSProperties = {
      left: `${field.x * scale}px`,
      top: `${pageHeight - (field.y + field.height) * scale}px`,
      width: `${field.width * scale}px`,
      height: `${field.height * scale}px`,
    };

    const fieldClassName = `field-container field-type-${field.type.toLowerCase()} ${
      isSelected ? 'selected' : ''
    } ${field.required ? 'required' : ''}`;

    return (
      <div
        key={field.id}
        style={fieldStyle}
        className={fieldClassName}
        onClick={(e) => {
          e.stopPropagation();
          setCurrentField(field);
        }}
        onMouseDown={(e) => {
          if (e.button === 0) {
            setIsDrawing(true);
            setCurrentField(field);
          }
        }}
        role="button"
        aria-label={`${field.type} field for ${signer?.name || 'unknown signer'}`}
        tabIndex={0}
      >
        <div className="field-label" title={field.label || field.type}>
          {field.label || field.type}
        </div>
        {signer && (
          <div className="field-signer" title={signer.name}>
            {signer.name}
          </div>
        )}
        
        {isSelected && (
          <>
            <div className="field-toolbar">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFieldDelete(field.id);
                  setCurrentField(null);
                }}
                className="delete"
                title="Delete field"
                aria-label="Delete field"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Resize handles */}
            <div className="resize-handle nw" />
            <div className="resize-handle ne" />
            <div className="resize-handle sw" />
            <div className="resize-handle se" />
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex">
      {/* Toolbar */}
      <div className="w-64 bg-white shadow-sm border-r p-4">
        <div className="space-y-6">
          {/* Tools */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Field Types</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleToolSelect('SIGNATURE')}
                className={`w-full flex items-center px-3 py-2 rounded-md text-sm ${
                  selectedTool === 'SIGNATURE'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <PencilIcon className="h-5 w-5 mr-2" />
                Signature
              </button>
              <button
                onClick={() => handleToolSelect('DATE')}
                className={`w-full flex items-center px-3 py-2 rounded-md text-sm ${
                  selectedTool === 'DATE'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CalendarDaysIcon className="h-5 w-5 mr-2" />
                Date
              </button>
              <button
                onClick={() => handleToolSelect('TEXT')}
                className={`w-full flex items-center px-3 py-2 rounded-md text-sm ${
                  selectedTool === 'TEXT'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <DocumentTextIcon className="h-5 w-5 mr-2" />
                Text
              </button>
              <button
                onClick={() => handleToolSelect('CHECKBOX')}
                className={`w-full flex items-center px-3 py-2 rounded-md text-sm ${
                  selectedTool === 'CHECKBOX'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CheckIcon className="h-5 w-5 mr-2" />
                Checkbox
              </button>
              <button
                onClick={() => handleToolSelect('INITIAL')}
                className={`w-full flex items-center px-3 py-2 rounded-md text-sm ${
                  selectedTool === 'INITIAL'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <PencilIcon className="h-5 w-5 mr-2" />
                Initial
              </button>
            </div>
          </div>

          {/* Signers */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Assign To</h3>
            <div className="space-y-2">
              {signers.map((signer) => (
                <button
                  key={signer.id}
                  onClick={() => handleSignerSelect(signer.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                    selectedSigner === signer.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <span>{signer.name}</span>
                    <span className="text-xs text-gray-500">{signer.email}</span>
                  </div>
                  <span className="text-xs font-medium">
                    Order: {signer.routingOrder}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Reset */}
          <div>
            <button
              onClick={() => {
                setSelectedTool(null);
                setSelectedSigner(null);
                setCurrentField(null);
              }}
              className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Reset Selection
            </button>
          </div>
        </div>
      </div>

      {/* PDF Preview */}
      <div 
        ref={pdfContainerRef}
        className="flex-1 relative bg-gray-100 cursor-crosshair"
        onClick={handlePageClick}
      >
        <PDFPreview
          file={documentUrl}
          onPageChange={(pageNum) => {
            setCurrentPage(pageNum);
          }}
          onPageLoad={(pageHeight) => {
            setPageHeight(pageHeight);
          }}
        />
        {fields
          .filter(field => field.page === currentPage)
          .map(field => renderField(field))}
      </div>
    </div>
  );
};

export default DocumentPreparation;