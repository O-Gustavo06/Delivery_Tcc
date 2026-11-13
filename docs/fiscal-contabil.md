# Fiscal: estrutura inicial

Esta área é uma preparação interna, não um emissor fiscal. A tela usa o Simples
Nacional como regime de referência; ao salvar a configuração, esse regime é
registrado para a empresa. UF e inscrição estadual são opcionais nesta etapa.
Apenas administradores podem configurar a empresa e criar rascunhos de entrada
ou saída, com vínculo opcional a uma compra ou pedido existente.

As referências tributárias por produto não são necessárias para criar
rascunhos. Dados já cadastrados continuam disponíveis em **Tributação** no
cardápio, na seção opcional **Dados fiscais avançados**. Esses campos são
referências, não regras tributárias universais; devem ser revisados por
profissional contábil para cada operação e legislação vigente.

O rascunho copia as referências e itens existentes no momento de sua criação.
Alterações posteriores nos produtos ou na configuração não modificam esses
registros. Vínculos são somente informativos: não criam pagamentos nem alteram
compras, pedidos ou movimentos de estoque. Compras são de ingredientes, que não
possuem o cadastro fiscal de produtos; seus itens não recebem tributação presumida.

O botão **Abrir editor de XML** abre uma aba lateral na qual é possível colar,
editar, salvar e baixar XML bem formado em UTF-8. O editor livre guarda um único
arquivo por administrador e empresa; salvar substitui o conteúdo anterior.
Rascunhos de NFC-e de saída também permitem abrir o editor associado ao
documento, com geração opcional de um XML interno a partir do cadastro.

O formato gerado `rascunhoNFCe` é próprio do sistema: não segue o schema
oficial, não é uma NFC-e e não pode ser transmitido à SEFAZ nem entregue como
documento autorizado. A geração usa os dados atuais da empresa e os itens e
referências copiados quando o rascunho foi criado. O editor não verifica a
validade fiscal ou assinatura de XML colado; editar um XML assinado pode
invalidar a assinatura, por isso o arquivo original deve ser preservado.
Os arquivos ficam no armazenamento privado local do Laravel
(`storage/app/private/fiscal`), que precisa ser persistido e incluído nos
backups junto com o banco. Não há assinatura, protocolo ou cálculo fiscal.

Não há apuração, autorização ou cancelamento oficial, importação, emissão, XML
fiscal autorizado ou DANFE nesta etapa. Não há caminho para promover um rascunho a nota autorizada.
Os indicadores de notas oficiais somente refletem registros futuros de uma
integração, e não devem ser interpretados como apuração de impostos. Antes de
emitir será necessário definir e validar as regras fiscais por operação, UF e
regime, certificados, numeração, contingência, integração/autorização SEFAZ,
armazenamento seguro dos documentos e tratamento de eventos e rejeições.

Para implantação, aplicar a nova migração Laravel ao banco correto após backup e
homologação. As tabelas legadas são pré-requisitos; não executar `migrate:fresh`
em produção. Publicar também a versão correspondente do frontend.
