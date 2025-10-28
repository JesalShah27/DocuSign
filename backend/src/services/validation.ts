import { type DocumentField, FieldType } from '../generated/prisma/client.js';

interface ValidationError {
  fieldId?: string;
  message: string;
  type: 'MISSING_FIELD' | 'INVALID_POSITION' | 'OVERLAP' | 'REQUIRED_EMPTY';
}

interface FieldValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface FieldBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export class ValidationService {
  /**
   * Check if fields overlap on the page
   */
  private checkOverlap(field1: FieldBounds, field2: FieldBounds): boolean {
    if (field1.page !== field2.page) return false;

    return !(
      field1.x + field1.width < field2.x ||
      field2.x + field2.width < field1.x ||
      field1.y + field1.height < field2.y ||
      field2.y + field2.height < field1.y
    );
  }

  /**
   * Validate position constraints for a field
   */
  private validatePosition(field: FieldBounds, pageWidth: number, pageHeight: number): ValidationError[] {
    const errors: ValidationError[] = [];

    if (field.x < 0 || field.y < 0) {
      errors.push({
        fieldId: field.id,
        message: 'Field position cannot be negative',
        type: 'INVALID_POSITION'
      });
    }

    if (field.x + field.width > pageWidth || field.y + field.height > pageHeight) {
      errors.push({
        fieldId: field.id,
        message: 'Field extends beyond page boundaries',
        type: 'INVALID_POSITION'
      });
    }

    return errors;
  }

  /**
   * Validate field value based on type
   */
  private validateFieldValue(field: DocumentField): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!field.required || field.value) return errors;

    // Only validate required fields
    switch (field.type) {
      case 'SIGNATURE':
        if (!field.value) {
          errors.push({
            fieldId: field.id,
            message: 'Signature is required',
            type: 'REQUIRED_EMPTY'
          });
        }
        break;

      case 'DATE':
        if (!field.value) {
          errors.push({
            fieldId: field.id,
            message: 'Date is required',
            type: 'REQUIRED_EMPTY'
          });
        }
        try {
          if (field.value && !Date.parse(field.value)) {
            errors.push({
              fieldId: field.id,
              message: 'Invalid date format',
              type: 'REQUIRED_EMPTY'
            });
          }
        } catch (e) {
          errors.push({
            fieldId: field.id,
            message: 'Invalid date format',
            type: 'REQUIRED_EMPTY'
          });
        }
        break;

      case 'TEXT':
        if (!field.value?.trim()) {
          errors.push({
            fieldId: field.id,
            message: 'Text is required',
            type: 'REQUIRED_EMPTY'
          });
        }
        break;

      case 'CHECKBOX':
        if (!['true', 'false'].includes(field.value || '')) {
          errors.push({
            fieldId: field.id,
            message: 'Checkbox must be checked',
            type: 'REQUIRED_EMPTY'
          });
        }
        break;

      case 'INITIAL':
        if (!field.value) {
          errors.push({
            fieldId: field.id,
            message: 'Initial is required',
            type: 'REQUIRED_EMPTY'
          });
        }
        break;
    }

    return errors;
  }

  /**
   * Check required field types per signer
   */
  private validateRequiredTypes(fields: DocumentField[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const signersMap = new Map<string, Set<FieldType>>();

    // Build map of field types per signer
    for (const field of fields) {
      const types = signersMap.get(field.signerId) || new Set();
      types.add(field.type);
      signersMap.set(field.signerId, types);
    }

    // Check if each signer has required fields
    for (const [signerId, types] of signersMap) {
      if (!types.has('SIGNATURE')) {
        errors.push({
          message: `Signer ${signerId} requires at least one signature field`,
          type: 'MISSING_FIELD'
        });
      }
    }

    return errors;
  }

  /**
   * Validate document fields
   */
  validateFields(fields: DocumentField[], pageWidth: number, pageHeight: number): FieldValidationResult {
    const errors: ValidationError[] = [];

    // Filter out any invalid fields
    const validFields = fields.filter((field): field is DocumentField & Required<Pick<DocumentField, 'id'>> => {
      return field !== null && field !== undefined && typeof field.id === 'string';
    });

    // Check field positions and overlaps
    validFields.forEach((field, index) => {
      const fieldBounds: FieldBounds = {
        id: field.id,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        page: field.page
      };

      // Validate position
      errors.push(...this.validatePosition(fieldBounds, pageWidth, pageHeight));

      // Check overlaps with other fields
      validFields.slice(index + 1).forEach(otherField => {
        const otherBounds: FieldBounds = {
          id: otherField.id,
          x: otherField.x,
          y: otherField.y,
          width: otherField.width,
          height: otherField.height,
          page: otherField.page
        };

        if (this.checkOverlap(fieldBounds, otherBounds)) {
          errors.push({
            fieldId: field.id,
            message: `Field overlaps with field ${otherField.id}`,
            type: 'OVERLAP'
          });
        }
      });

      // Validate field value if present
      errors.push(...this.validateFieldValue(field));
    });

    // Validate required field types
    errors.push(...this.validateRequiredTypes(validFields));

    return {
      valid: errors.length === 0,
      errors
    };
  }
}