'use server'
import {z} from "zod"
import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import {redirect} from "next/navigation"
import {signIn} from "@/auth"
import { AuthError } from "next-auth"

const FormSchema = z.object({
    id:z.string(),
    customerId:z.string({invalid_type_error:"Please select a customer"}),
    amount:z.coerce.number().gt(0,{message: 'Please enter an amount greater than $0.'}),
    status: z.enum(['pending', 'paid'],{invalid_type_error:'Please select an invoice status.'}),
    date: z.string(),
})

const CreateInvoice = FormSchema.omit({id:true,date:true})

const UpdateInvoice = FormSchema.omit({id:true,date:true})

export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(previous:State,formData:FormData){
    const validatedFields:any = CreateInvoice.safeParse(Object.fromEntries(formData.entries()))
    if(!validatedFields.success){
        console.log(typeof validatedFields.error)
        console.log(validatedFields.error.flatten().fieldErrors)
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
          };
    }
    const {customerId,amount,status} = validatedFields.data
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];
    try{
        await sql`INSERT INTO invoices (customer_id,status,amount,date)
        VALUES(${customerId},${status},${amountInCents},${date})`;
    }
    catch(e){
        return {
            message: 'Database Error: Failed to Create Invoice.',
          };
    }
    // const rawData2 = Object.fromEntries(formData.entries())
    // console.log(rawData2)
    revalidatePath("/dashboard/invoices")
    redirect("/dashboard/invoices")
}

export const updateInvoice = async(id:string,formData:FormData)=>{
    const {customerId,amount,status} = UpdateInvoice.parse(Object.fromEntries(formData.entries()))

    const amountInCents = amount * 100;
    try{
    await sql`UPDATE invoices SET customer_id=${customerId},amount=${amountInCents},status=${status} WHERE id=${id}`;
    }
    catch(e){
        return {
            message: 'Database Error: Failed to Update Invoice.',
          };
    }
    revalidatePath("/dashboard/invoices")
    redirect("/dashboard/invoices")
}

export const deleteInvoice = async(id:string)=>{
    //throw new Error('Failed to Delete Invoice');
    try{
        await sql`DELETE FROM invoices WHERE id=${id}`;
    }
    catch(e){
        return {
            message: 'Database Error: Failed to Delete Invoice.',
          };
    }
    revalidatePath("/dashboard/invoices")
}

export const authenticate = async(prevState:string|undefined,formData:FormData)=>{
    try{    
        await signIn('credentials',formData)
    }
    catch(error){
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