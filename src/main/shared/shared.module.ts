import { Module } from '@nestjs/common';
import { ContactModule } from './contact/contact.module';

@Module({
  controllers: [],
  providers: [],
  imports: [ContactModule],
})
export class SharedModule {}
