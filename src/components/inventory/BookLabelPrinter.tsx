import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Printer, Barcode } from 'lucide-react';
import { Book } from '@/types/database';
import { useEffect } from 'react';

interface BookLabelPrinterProps {
  open: boolean;
  onClose: () => void;
  book: Book | null;
  quantity: number;
  price: number;
}

export function BookLabelPrinter({ open, onClose, book, quantity, price }: BookLabelPrinterProps) {
  const [labelCount, setLabelCount] = useState(quantity);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLabelCount(quantity);
  }, [quantity]);

  // Generate barcode from ISBN or book ID
  const getBarcodeValue = () => {
    if (book?.isbn) {
      // Remove any hyphens from ISBN
      return book.isbn.replace(/-/g, '');
    }
    // Use first 12 chars of UUID if no ISBN
    return book?.id.replace(/-/g, '').substring(0, 12).toUpperCase() || '000000000000';
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print labels');
      return;
    }

    const labels = [];
    for (let i = 0; i < labelCount; i++) {
      labels.push(`
        <div class="label">
          <div class="title">${book?.title || 'Unknown'}</div>
          ${book?.author ? `<div class="author">${book.author}</div>` : ''}
          <svg class="barcode" id="barcode-${i}"></svg>
          <div class="price">$${price.toFixed(2)}</div>
        </div>
      `);
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Book Labels - ${book?.title}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        <style>
          @page {
            size: 2.25in 1.25in;
            margin: 0;
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
          }
          .labels-container {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            padding: 4px;
          }
          .label {
            width: 2.25in;
            height: 1.25in;
            border: 1px dashed #ccc;
            padding: 4px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            page-break-inside: avoid;
            background: white;
          }
          .title {
            font-weight: bold;
            font-size: 10px;
            text-align: center;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin-bottom: 2px;
          }
          .author {
            font-size: 8px;
            color: #666;
            text-align: center;
            margin-bottom: 4px;
          }
          .barcode {
            max-width: 100%;
            height: 40px;
          }
          .price {
            font-weight: bold;
            font-size: 14px;
            margin-top: 2px;
          }
          @media print {
            .label {
              border: none;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="labels-container">
          ${labels.join('')}
        </div>
        <script>
          window.onload = function() {
            for (let i = 0; i < ${labelCount}; i++) {
              JsBarcode("#barcode-" + i, "${getBarcodeValue()}", {
                format: "${book?.isbn ? 'EAN13' : 'CODE128'}",
                width: 1.5,
                height: 35,
                displayValue: true,
                fontSize: 8,
                margin: 0
              });
            }
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!book) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Print Labels
          </DialogTitle>
          <DialogDescription>
            Print barcode labels for received books
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Book Info */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Book:</span>
              <span className="font-medium text-right max-w-[60%] truncate">{book.title}</span>
            </div>
            {book.author && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Author:</span>
                <span>{book.author}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Barcode:</span>
              <span className="font-mono text-sm">{getBarcodeValue()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price:</span>
              <span className="font-bold text-green-600">${price.toFixed(2)}</span>
            </div>
          </div>

          {/* Label Preview */}
          <div className="border rounded-lg p-4 bg-white" ref={printRef}>
            <div className="flex flex-col items-center">
              <p className="font-bold text-sm text-center truncate max-w-full">{book.title}</p>
              {book.author && <p className="text-xs text-gray-500">{book.author}</p>}
              <div className="my-2 flex items-center justify-center">
                <Barcode className="w-32 h-10" />
              </div>
              <p className="text-xs font-mono">{getBarcodeValue()}</p>
              <p className="font-bold text-lg mt-1">${price.toFixed(2)}</p>
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label>Number of Labels to Print</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLabelCount(Math.max(1, labelCount - 1))}
              >
                -
              </Button>
              <Input
                type="number"
                min="1"
                value={labelCount}
                onChange={(e) => setLabelCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLabelCount(labelCount + 1)}
              >
                +
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLabelCount(quantity)}
              >
                Reset ({quantity})
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Skip
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print {labelCount} Label{labelCount > 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
