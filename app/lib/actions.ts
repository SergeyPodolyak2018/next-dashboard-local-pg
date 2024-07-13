'use server'
import { z } from 'zod';
import {createInvoices, updateInvoices, deleteInvoices} from './data'
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
 
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});
 
const CreateInvoice = FormSchema.omit({ id: true, date: true });
 

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};
 
export async function createInvoice(prevState: State, formData: FormData) {
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  // Test it out:
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }
  const amountInCents = validatedFields.data.amount * 100;
  const date = new Date().toISOString().split('T')[0];
  const result= await createInvoices({
    customer_id:validatedFields.data.customerId, 
    amount:amountInCents,
    status:validatedFields.data.status,
    date,
    id:''
  });
  console.log(result);
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
  return result;

}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });
 

export async function updateInvoice(id: string, formData: FormData) {

  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  console.log(customerId, amount,status,id)
  const amountInCents = amount * 100;
  const result= await updateInvoices({customer_id:customerId, amount,status,id});
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
  return result
}

export async function deleteInvoice(id: string) {
  const result= await deleteInvoices(id);
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
  return result;
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}
